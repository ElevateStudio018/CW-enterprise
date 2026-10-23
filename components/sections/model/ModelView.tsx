"use client";

import { useEffect, useRef, useState } from "react";

type Controller = { highlight(i: number): void; dispose(): void };

/**
 * The 3D model itself, drawn by three.js once it is in the browser. Without WebGL the box keeps a short description.
 * Elements with data-highlight="<n>" in the same section light up the model's part n while pointed at.
 */
export function ModelView({ model, labels, colors }: { model: string; labels: string[]; colors: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ctrl: Controller | undefined;
    let cancelled = false;
    const cleanups: (() => void)[] = [];
    try {
      const canvas = document.createElement("canvas");
      if (!(canvas.getContext("webgl2") || canvas.getContext("webgl"))) return;
    } catch {
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./scenes.js").then(({ mount }) => {
      if (cancelled) return;
      ctrl = mount(el, { reduceMotion }) as Controller | undefined;
      setReady(true);
      const scope = el.closest("section") ?? document;
      scope.querySelectorAll<HTMLElement>("[data-highlight]").forEach((target) => {
        const on = () => ctrl?.highlight(Number(target.dataset.highlight));
        const off = () => ctrl?.highlight(-1);
        target.addEventListener("pointerenter", on);
        target.addEventListener("pointerleave", off);
        cleanups.push(() => {
          target.removeEventListener("pointerenter", on);
          target.removeEventListener("pointerleave", off);
        });
      });
    });
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      ctrl?.dispose();
    };
  }, [model, labels.join("|"), colors.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      className={`model${ready ? " is-ready" : ""}`}
      data-model={model}
      data-colors={colors.filter(Boolean).join(",")}
      data-accent={model !== "koncern" ? colors.find(Boolean) : undefined}
      data-scroll-turn={model === "koncern" ? "" : undefined}
    >
      <div className="model-fallback">3D-modell</div>
      <div className="labels" aria-hidden="true">
        {labels.map((label, i) =>
          label ? (
            <div className="label" data-anchor={i} key={i}>
              <span>{label}</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
