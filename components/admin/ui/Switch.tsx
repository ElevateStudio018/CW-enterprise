"use client";

import { useId } from "react";

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (checked: boolean) => void; label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-[14px] font-semibold text-admin-ink">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-[13px] text-admin-muted">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin ${
          checked ? "bg-admin" : "bg-stone-300"
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
