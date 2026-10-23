"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown, Eye, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "../ui/Badge";
import { AdminButton } from "../ui/Button";
import { TextField } from "../ui/Field";
import { FieldList } from "./FieldEditor";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { list } from "@/lib/site/collection.ts";
import { sectionFields, sectionTypeLabels } from "@/lib/site/labels.ts";
import type { Section, SiteData } from "@/lib/site/schema.ts";

type Obj = Record<string, unknown>;

export function sectionName(section: Section): string {
  return section.label || sectionTypeLabels[section.type].label;
}

/** One section of a page: its name and heading, a switch to show or hide it, and its fields when opened. */
export function SectionCard({
  pageId,
  section,
  draft,
  open,
  onToggle,
  onActivate,
  onRemove,
  handle,
}: {
  pageId: string;
  section: Section & { id: string };
  draft: SiteData;
  open: boolean;
  onToggle: () => void;
  /** Focus moved into the card: the preview shows this section. */
  onActivate: () => void;
  onRemove: () => void;
  handle: ReactNode;
}) {
  const { store } = useDraft();
  const bodyId = useId();
  const base = ["pages", "items", pageId, "sections", "items", section.id];
  const meta = sectionTypeLabels[section.type];
  const name = sectionName(section);
  const heading = "heading" in section ? section.heading : "";
  const page = draft.pages.items[pageId];
  const otherAnchors = list(page.sections)
    .filter((other) => other.id !== section.id)
    .map((other) => other.anchor)
    .filter(Boolean);
  const anchorTaken = Boolean(section.anchor) && otherAnchors.includes(section.anchor);

  return (
    <div
      onFocusCapture={onActivate}
      className={`rounded-2xl ring-1 transition ${open ? "bg-white ring-admin/30" : "bg-white ring-admin-line hover:ring-stone-300"} ${
        section.hidden ? "bg-white/70" : ""
      }`}
    >
      <div className="flex items-center gap-1 py-1 pl-1 pr-2">
        {handle}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={`truncate text-[15px] font-semibold ${section.hidden ? "text-admin-muted" : "text-admin-ink"}`}>{name}</span>
              {section.hidden && <Badge tone="warning">Dold</Badge>}
            </span>
            <span className="block truncate text-[13px] text-admin-muted">{heading || meta.description}</span>
          </span>
          <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-admin-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          aria-pressed={!section.hidden}
          aria-label={`Visa ”${name}” på hemsidan`}
          title={section.hidden ? "Dold – tryck för att visa den på hemsidan" : "Synlig – tryck för att dölja den"}
          onClick={() => store.edit([...base, "hidden"], !section.hidden)}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
            section.hidden
              ? "text-amber-700 hover:bg-amber-50"
              : // In the row SortableList draws (group/sort): shown when pointed at or focused, always on touch screens.
                "text-admin-muted hover:bg-stone-100 hover:text-admin-ink can-hover:opacity-0 can-hover:group-hover/sort:opacity-100 group-focus-within/sort:opacity-100"
          }`}
        >
          {section.hidden ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id={bodyId} className="admin-fade border-t border-admin-line px-4 pb-5 pt-5 sm:px-5">
          <FieldList fields={sectionFields[section.type]} base={base} object={section as unknown as Obj} draft={draft} />

          <details className="group mt-6 border-t border-admin-line pt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-[14px] font-medium text-admin-muted hover:text-admin-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin [&::-webkit-details-marker]:hidden">
              Fler inställningar
              <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 pb-1 pt-2">
              <TextField
                label="Namn här i adminpanelen"
                value={section.label}
                recommended={40}
                onChange={(value) => store.edit([...base, "label"], value)}
                hint={`Syns inte på hemsidan. Lämna tomt för ”${meta.label}”.`}
              />
              <TextField
                label="Ankare för länkar"
                value={section.anchor}
                onChange={(value) =>
                  store.edit(
                    [...base, "anchor"],
                    value
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[̀-ͯ]/g, "")
                      .replace(/[^a-z0-9-]+/g, "-")
                      .slice(0, 40)
                  )
                }
                error={anchorTaken ? "Ett annat avsnitt på sidan har redan det ankaret." : undefined}
                hint={
                  section.anchor
                    ? `Länkar hit med ${page.slug ? `/${page.slug}` : "/"}#${section.anchor}. Byter du det slutar sådana länkar fungera.`
                    : "Ge avsnittet ett ankare, t.ex. ”omdomen”, om menyn eller en knapp ska kunna länka hit."
                }
                autoCapitalize="none"
                spellCheck={false}
              />
              <AdminButton variant="ghost" size="sm" icon={Trash2} onClick={onRemove} className="text-red-700 hover:bg-red-50">
                Ta bort sektionen
              </AdminButton>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
