"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Skeleton } from "../ui/Skeleton";
import { basePath } from "@/lib/admin/config";
import { PREVIEW_READY, type PreviewMessage, type PreviewTarget } from "@/lib/admin/preview";
import type { SiteData } from "@/lib/site/schema.ts";

const widths = { desktop: 1280, mobile: 390 } as const;
type Device = keyof typeof widths;

/**
 * The site as it will look, drawn by the site's own components in a frame and updated with every keystroke (the draft
 * is posted to the frame; nothing is saved or reloaded for it). Desktop is shown scaled down to fit.
 */
export function PreviewPane({ draft, target, className = "" }: { draft: SiteData; target: PreviewTarget; className?: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [box, setBox] = useState({ width: 0, height: 0 });
  const latest = useRef({ draft, target });
  latest.current = { draft, target };

  // Phones start in the phone view.
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setDevice("mobile");
  }, []);

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // One message per frame at most, however fast the typing.
  const frame = useRef(0);
  const post = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const message: PreviewMessage = { type: "cwe-preview", ...latest.current };
      frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
    });
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === PREVIEW_READY) {
        setReady(true);
        post();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post]);

  useEffect(() => {
    if (ready) post();
  }, [draft, target, ready, post]);

  const virtualWidth = widths[device];
  const scale = box.width > 0 ? Math.min(1, box.width / virtualWidth) : 1;
  const frameWidth = virtualWidth;
  const frameHeight = box.height / scale;
  const offset = Math.max(0, (box.width - virtualWidth * scale) / 2);

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-admin-line ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-admin-line px-3 py-2">
        <p className="flex items-center gap-2 pl-1 text-[13px] font-semibold text-admin-muted">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
          Förhandsvisning
          <span className="sr-only">– uppdateras medan du skriver</span>
        </p>
        <div role="group" aria-label="Skärmstorlek" className="flex rounded-xl bg-stone-100 p-1">
          {(
            [
              ["desktop", Monitor, "Dator"],
              ["mobile", Smartphone, "Mobil"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={device === id}
              onClick={() => setDevice(id)}
              className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
                device === id ? "bg-white text-admin-ink shadow-sm" : "text-admin-muted hover:text-admin-ink"
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden bg-stone-100">
        {/* Kept mounted while hidden, so showing it again does not reload the page inside. */}
        <iframe
          ref={frameRef}
          title="Förhandsvisning av hemsidan"
          src={`${basePath}/admin/forhandsvisning/`}
          style={{ width: frameWidth, height: frameHeight || "100%", transform: `scale(${scale})`, left: offset }}
          className={`absolute top-0 origin-top-left border-0 bg-white transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"} ${
            device === "mobile" && scale === 1 ? "shadow-[0_0_0_1px_rgba(30,30,28,0.08)]" : ""
          }`}
        />
        {!ready && (
          <div className="absolute inset-0 space-y-4 p-6" role="status" aria-label="Förhandsvisningen laddas">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        )}
      </div>
    </div>
  );
}
