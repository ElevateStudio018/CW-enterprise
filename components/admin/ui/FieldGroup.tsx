import type { ReactNode } from "react";

/** Fields that belong together (a button's text and link, an image, the Google result): a quiet tinted box with its name
 * inside, at the top. */
export function FieldGroup({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl bg-stone-50 p-4 pt-3">
      {/* A floated legend sits inside the box instead of on its edge; what follows clears it. */}
      <legend className="float-left mb-3 w-full text-[13px] font-semibold text-admin-muted">{label}</legend>
      <div className="clear-both">
        {hint && <p className="-mt-1 mb-3 text-[13px] leading-snug text-admin-muted">{hint}</p>}
        {children}
      </div>
    </fieldset>
  );
}
