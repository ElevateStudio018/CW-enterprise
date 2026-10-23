import type { ReactNode } from "react";
import { GrowLine } from "./GrowLine";

/** A call-to-action block with an olive bar down its left side, which grows down from the top as it comes into view. */
export function AccentBlock({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`relative pl-[30px] ${className}`}>
      <GrowLine axis="y" className="absolute inset-y-0 left-0 w-[6px] bg-accent" />
      {children}
    </div>
  );
}
