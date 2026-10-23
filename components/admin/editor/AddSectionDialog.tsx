"use client";

import { Dialog } from "../ui/Dialog";
import { sectionTypeLabels } from "@/lib/site/labels.ts";
import { sectionChoices } from "@/lib/admin/templates";
import type { SectionType } from "@/lib/site/schema.ts";

/** Picks the kind of section to add; each kind with a line about what it is. */
export function AddSectionDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (type: SectionType) => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Lägg till en sektion"
      description="Den nya sektionen är dold tills du slår på den, så du kan skriva klart i lugn och ro."
      size="lg"
    >
      <div className="space-y-6">
        {sectionChoices.map((group) => (
          <section key={group.group} aria-label={group.group}>
            <h3 className="mb-2 text-[13px] font-semibold text-admin-muted">{group.group}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {group.types.map((type) => (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => onPick(type)}
                    className="flex min-h-16 w-full flex-col justify-center rounded-xl bg-white px-4 py-3 text-left ring-1 ring-admin-line transition hover:bg-stone-50 hover:ring-admin/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
                  >
                    <span className="text-[15px] font-semibold text-admin-ink">{sectionTypeLabels[type].label}</span>
                    <span className="mt-0.5 text-[13px] leading-snug text-admin-muted">{sectionTypeLabels[type].description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
