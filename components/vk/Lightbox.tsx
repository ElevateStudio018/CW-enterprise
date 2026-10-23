"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

interface Shown {
  links: HTMLAnchorElement[];
  index: number;
}

/** Opens any link marked data-lb (a gallery photo) large, with arrows through the photos of the same group. */
export function Lightbox({ labels }: { labels: { close: string; previous: string; next: string } }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const go = useCallback((step: number) => {
    setShown((s) => (s ? { ...s, index: (s.index + step + s.links.length) % s.links.length } : s));
  }, []);
  const close = useCallback(() => {
    setShown(null);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-lb]");
      if (!link || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      opener.current = link;
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[data-lb="${link.dataset.lb}"]`));
      setShown({ links, index: links.indexOf(link) });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!shown) return;
    closeButton.current?.focus();
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [shown, close, go]);

  const touchX = useRef<number | null>(null);
  if (!shown) return null;
  const link = shown.links[shown.index];
  const img = link.querySelector("img");

  return (
    <div
      className="lb"
      role="dialog"
      aria-modal="true"
      onClick={(event) => event.target === event.currentTarget && close()}
      onTouchStart={(event) => (touchX.current = event.touches[0].clientX)}
      onTouchEnd={(event) => {
        if (touchX.current === null) return;
        const dx = event.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <button ref={closeButton} className="lb-x" type="button" aria-label={labels.close} onClick={close}>
        <Icon name="X" className="ic" />
      </button>
      {shown.links.length > 1 && (
        <button className="lb-prev" type="button" aria-label={labels.previous} onClick={() => go(-1)}>
          <Icon name="ChevronLeft" className="ic" />
        </button>
      )}
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={link.href} alt={img?.alt ?? ""} />
        <figcaption>{`${link.dataset.cap ?? ""}  ·  ${shown.index + 1} / ${shown.links.length}`}</figcaption>
      </figure>
      {shown.links.length > 1 && (
        <button className="lb-next" type="button" aria-label={labels.next} onClick={() => go(1)}>
          <Icon name="ChevronRight" className="ic" />
        </button>
      )}
    </div>
  );
}
