"use client";

import type { CSSProperties } from "react";
import { useInView } from "@/hooks/useInView";

export interface FaktaRow {
  label: string;
  value: string;
}

/** Facts on the primary colour. The lines between the rows draw in from the left, one after another, as the list comes into view. */
export function FaktaBox({ title, rows }: { title: string; rows: FaktaRow[] }) {
  const { ref, isInView } = useInView<HTMLDListElement>();

  return (
    <div className="bg-primary px-6 py-7 text-on-primary sm:px-8 sm:py-8">
      <h3 className="text-[24px] font-semibold leading-tight">{title}</h3>
      <dl ref={ref} className="mt-3">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`relative grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 py-4 text-[17px] leading-snug after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:bg-on-primary/70 after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.33,1,0.68,1)] after:[transition-delay:var(--line-delay)] last:pb-0 last:after:hidden ${
              isInView ? "after:scale-x-100" : "after:scale-x-0"
            }`}
            style={{ "--line-delay": `${60 + index * 50}ms` } as CSSProperties}
          >
            <dt className="font-bold">{row.label}:</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
