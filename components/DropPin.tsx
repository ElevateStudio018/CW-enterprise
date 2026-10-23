"use client";

import { Icon } from "./Icon";
import { useInView } from "@/hooks/useInView";

/** The map pin by the address, dropping into place with a small bounce the first time it comes into view. */
export function DropPin({ className = "" }: { className?: string }) {
  const { ref, isInView } = useInView<HTMLSpanElement>();

  return (
    <span ref={ref} className={`${isInView ? "animate-pin-drop" : "opacity-0"} ${className}`}>
      <Icon name="MapPin" strokeWidth={2.25} className="h-6 w-6 text-accent" />
    </span>
  );
}
