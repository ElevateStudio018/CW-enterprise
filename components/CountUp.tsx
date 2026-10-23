"use client";

import { useEffect, useState } from "react";
import { useInView } from "@/hooks/useInView";

/**
 * A number that counts up from zero, easing out, the first time it scrolls into view. The real value is what the
 * server renders and what screen readers get, so nothing depends on the animation running.
 */
export function CountUp({ value, durationMs = 1400 }: { value: number; durationMs?: number }) {
  const { ref, isInView } = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    if (!isInView) {
      setShown(0);
      return;
    }

    let frame = 0;
    // Timed from the first frame's own timestamp: a frame can be stamped slightly before the moment it was
    // requested, which would make the first step negative.
    let start: number | null = null;
    function tick(now: number) {
      start ??= now;
      const progress = Math.min(1, (now - start) / durationMs);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isInView, value, durationMs]);

  return (
    <span ref={ref}>
      <span aria-hidden="true" className="tabular-nums">
        {shown}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
