"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../Icon";

/** The reviews in a row to page through with the arrows (or by swiping); the arrows grey out at either end. */
export function ReviewSlider({ head, aside, children, labels }: { head: ReactNode; aside?: ReactNode; children: ReactNode; labels: { previous: string; next: string } }) {
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      setAtStart(el.scrollLeft < 4);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function step(direction: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const item = el.querySelector("li");
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    el.scrollBy({ left: direction * (item ? item.getBoundingClientRect().width + gap : el.clientWidth), behavior: "smooth" });
  }

  return (
    <>
      <div className="sec-head">
        {head}
        <div className="rev-nav">
          {aside}
          <span className="rev-btns">
            <button type="button" aria-label={labels.previous} disabled={atStart} onClick={() => step(-1)}>
              <Icon name="ChevronLeft" className="ic" />
            </button>
            <button type="button" aria-label={labels.next} disabled={atEnd} onClick={() => step(1)}>
              <Icon name="ChevronRight" className="ic" />
            </button>
          </span>
        </div>
      </div>
      <div className="rev-slider">
        <ul className="rev-track" ref={track} tabIndex={0}>
          {children}
        </ul>
      </div>
    </>
  );
}
