"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { AdminButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { ImagePicker } from "../images/ImagePicker";
import { AddSectionDialog } from "./AddSectionDialog";
import { FieldList } from "./FieldEditor";
import { SectionCard, sectionName } from "./SectionCard";
import { SortableList } from "./SortableList";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { list, newId } from "@/lib/site/collection.ts";
import { pageFields, sectionFields, sectionTypeLabels } from "@/lib/site/labels.ts";
import { needsImage, newSection } from "@/lib/admin/templates";
import type { Section, SectionType, SiteData } from "@/lib/site/schema.ts";

type Obj = Record<string, unknown>;

/** A page in the editor: its name and Google texts, then its sections in the order the site shows them. */
export function PageEditor({
  pageId,
  draft,
  openSection,
  onOpenSection,
  onActiveSection,
}: {
  pageId: string;
  draft: SiteData;
  openSection: string | null;
  onOpenSection: (id: string | null) => void;
  onActiveSection: (id: string | null) => void;
}) {
  const { store } = useDraft();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [waitingForImage, setWaitingForImage] = useState<SectionType | null>(null);
  const [removing, setRemoving] = useState<(Section & { id: string }) | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const page = draft.pages.items[pageId];
  const base = ["pages", "items", pageId, "sections"];
  const sections = list(page.sections);

  function insert(section: Section) {
    const id = newId(page.sections, sectionTypeLabels[section.type].label);
    const order = [...page.sections.order];
    const after = openSection ? order.indexOf(openSection) : -1;
    order.splice(after >= 0 ? after + 1 : order.length, 0, id);
    store.editMany([
      { path: [...base, "items", id], op: "set", value: section },
      { path: [...base, "order"], op: "set", value: order },
    ]);
    onOpenSection(id);
    onActiveSection(id);
    toast.success("Sektionen är tillagd. Den är dold tills du slår på den med ögat.");
  }

  function pick(type: SectionType) {
    setAdding(false);
    if (needsImage(type)) setWaitingForImage(type);
    else insert(newSection(type));
  }

  function remove(section: Section & { id: string }) {
    store.editMany([
      { path: [...base, "items", section.id], op: "delete" },
      { path: [...base, "order"], op: "set", value: page.sections.order.filter((id) => id !== section.id) },
    ]);
    setRemoving(null);
    if (openSection === section.id) onOpenSection(null);
    toast.info("Sektionen är borttagen. Tryck Ångra om det blev fel.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white ring-1 ring-admin-line">
        <button
          type="button"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin sm:px-5"
        >
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-admin-ink">Sidans namn och Google</span>
            <span className="block truncate text-[13px] text-admin-muted">
              {page.seo.title || "Ingen titel för sökresultat än"} · {page.slug ? `/${page.slug}` : "/"}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-admin-subtle transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`} />
        </button>
        {settingsOpen && (
          <div className="admin-fade border-t border-admin-line px-4 pb-5 pt-5 sm:px-5">
            <FieldList fields={pageFields} base={["pages", "items", pageId]} object={page as unknown as Obj} draft={draft} />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3 px-1 pt-3">
        <h2 className="text-[15px] font-semibold text-admin-ink">
          Sektioner <span className="font-normal text-admin-muted">· i den ordning de visas</span>
        </h2>
        <span className="text-[13px] tabular-nums text-admin-muted">{sections.length} st</span>
      </div>

      <SortableList
        label={`Sektioner på ${page.slug ? page.title : "startsidan"}`}
        items={sections}
        onMove={(order) => store.edit([...base, "order"], order)}
        renderItem={(section, handle) => (
          <SectionCard
            pageId={pageId}
            section={section}
            draft={draft}
            handle={handle}
            open={openSection === section.id}
            onToggle={() => {
              const next = openSection === section.id ? null : section.id;
              onOpenSection(next);
              if (next) onActiveSection(next);
            }}
            onActivate={() => onActiveSection(section.id)}
            onRemove={() => setRemoving(section)}
          />
        )}
      />

      <AdminButton variant="ghost" icon={Plus} onClick={() => setAdding(true)} className="w-full border border-dashed border-stone-300 hover:border-admin/40 hover:bg-white">
        Lägg till sektion
      </AdminButton>

      <AddSectionDialog open={adding} onClose={() => setAdding(false)} onPick={pick} />
      <ImagePicker
        open={waitingForImage !== null}
        onClose={() => setWaitingForImage(null)}
        usage={waitingForImage ? sectionFields[waitingForImage].find((field) => field.kind === "image")?.imageUsage : undefined}
        title={waitingForImage ? `Välj en bild till ”${sectionTypeLabels[waitingForImage].label}”` : "Välj bild"}
        onSelect={(image) => {
          if (waitingForImage) insert(newSection(waitingForImage, image));
          setWaitingForImage(null);
        }}
      />
      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `Ta bort ”${sectionName(removing)}”?` : ""}
        description="Sektionen och dess innehåll försvinner från utkastet. Vill du bara att den inte syns kan du dölja den med ögat i stället."
        size="sm"
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setRemoving(null)} data-autofocus>
              Behåll
            </AdminButton>
            <AdminButton variant="danger" onClick={() => removing && remove(removing)}>
              Ta bort
            </AdminButton>
          </>
        }
      />
    </div>
  );
}
