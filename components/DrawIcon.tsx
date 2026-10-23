"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { LucideProps } from "lucide-react";
import { Icon, type IconKey } from "./Icon";
import { useInView } from "@/hooks/useInView";

interface DrawIconProps {
  name: IconKey;
  /** For the wrapper, which takes the icon's place in the layout. */
  className?: string;
  iconClassName?: string;
  strokeWidth?: LucideProps["strokeWidth"];
  /** Wait before drawing. Can also be set per breakpoint with [--draw-delay:…] classes on the wrapper. */
  delayMs?: number;
}

/** A line icon that draws itself stroke by stroke, like the tick in the thank-you, the first time it comes into view. */
export function DrawIcon({ name, className = "", iconClassName = "", strokeWidth, delayMs }: DrawIconProps) {
  const { ref, isInView } = useInView<HTMLSpanElement>();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Length 1 on every stroke, so long and short ones take the same time to draw.
    ref.current?.querySelectorAll("svg *").forEach((shape) => shape.setAttribute("pathLength", "1"));
    setIsReady(true);
  }, [ref]);

  return (
    <span
      ref={ref}
      className={`icon-draw ${isReady && isInView ? "is-drawn" : ""} ${className}`}
      style={delayMs === undefined ? undefined : ({ "--draw-delay": `${delayMs}ms` } as CSSProperties)}
    >
      <Icon name={name} className={iconClassName} {...(strokeWidth === undefined ? {} : { strokeWidth })} />
    </span>
  );
}
