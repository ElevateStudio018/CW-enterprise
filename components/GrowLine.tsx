"use client";

import { useInView } from "@/hooks/useInView";

/**
 * A thin bar that grows into place, from the left or from the top, the first time it comes into view. Its size,
 * colour, position and any transition delay come in through className.
 */
export function GrowLine({ className = "", axis = "x" }: { className?: string; axis?: "x" | "y" }) {
  const { ref, isInView } = useInView<HTMLSpanElement>();
  const hidden = axis === "x" ? "scale-x-0" : "scale-y-0";

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`block transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] ${
        axis === "x" ? "origin-left" : "origin-top"
      } ${isInView ? "" : hidden} ${className}`}
    />
  );
}
