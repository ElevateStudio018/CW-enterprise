"use client";

import { Card, CardHeader } from "../ui/Card";
import { CollectionEditor, FieldList } from "./FieldEditor";
import { list } from "@/lib/site/collection.ts";
import { rootCollections, rootFields } from "@/lib/site/labels.ts";
import type { PreviewTarget } from "@/lib/admin/preview";
import type { SiteData } from "@/lib/site/schema.ts";

type Obj = Record<string, unknown>;
type CollectionRoot = keyof typeof rootCollections;
type FieldsRoot = keyof typeof rootFields;

export interface Part {
  id: string;
  label: string;
  group: string;
  description: string;
  root: CollectionRoot | FieldsRoot;
}

/** Everything besides the pages that the editor offers, in the order of its menu. */
export const parts: Part[] = [
  {
    id: "tjanster",
    label: "Alla tjänster",
    group: "Listor som visas på flera sidor",
    description: "Tjänsterna visas på startsidan och i menyn, och var och en har en egen sida.",
    root: "services",
  },
  {
    id: "uppdrag",
    label: "Alla uppdrag",
    group: "Listor som visas på flera sidor",
    description: "Uppdragen i bildspelet på startsidan och på uppdragssidan.",
    root: "uppdrag",
  },
  {
    id: "certifikat",
    label: "Alla certifikat",
    group: "Listor som visas på flera sidor",
    description: "Certifikaten och behörigheterna på certifikatsidan.",
    root: "certificates",
  },
  { id: "meny", label: "Menyn", group: "Delar av varje sida", description: "Menyraden högst upp och menyn som öppnas med knappen.", root: "navigation" },
  {
    id: "sidfot",
    label: "Sidfoten",
    group: "Delar av varje sida",
    description: "Längst ner på varje sida. Telefon, e-post och adress hämtas från Företagsuppgifter under Inställningar.",
    root: "footer",
  },
  { id: "formular", label: "Offertformuläret", group: "Delar av varje sida", description: "Formuläret där besökare begär offert.", root: "form" },
  { id: "tjanstesidor", label: "Tjänstesidornas texter", group: "Övrigt", description: "Texter som är gemensamma för alla tjänstesidor.", root: "servicePage" },
  { id: "saknad-sida", label: "Sidan som inte finns", group: "Övrigt", description: "Visas om någon går till en adress som inte finns.", root: "notFound" },
  { id: "texter", label: "Övriga texter", group: "Övrigt", description: "Små texter här och där, bland annat sådana som skärmläsare läser upp.", root: "ui" },
];

/** What the preview shows while a part is edited. */
export function partTarget(part: Part, draft: SiteData, activeItem: string | null): PreviewTarget {
  const pages = list(draft.pages);
  const findSection = (types: string[]): PreviewTarget | null => {
    for (const type of types) {
      for (const page of pages) {
        const section = list(page.sections).find((candidate) => candidate.type === type && !candidate.hidden);
        if (section) return { kind: "page", pageId: page.id, sectionId: section.id };
      }
    }
    return null;
  };
  const home = pages.find((page) => page.slug === "") ?? pages[0];
  const fallback: PreviewTarget = { kind: "page", pageId: home.id };
  switch (part.root) {
    case "services":
    case "servicePage": {
      const serviceId = activeItem && draft.services.items[activeItem] ? activeItem : draft.services.order[0];
      return serviceId ? { kind: "service", serviceId } : fallback;
    }
    case "uppdrag":
      return findSection(["uppdragGrid", "uppdragCarousel"]) ?? fallback;
    case "certificates":
      return findSection(["certificates"]) ?? fallback;
    case "navigation":
      return { kind: "chrome", part: "navigation" };
    case "footer":
      return { kind: "chrome", part: "footer" };
    case "form":
      return { kind: "chrome", part: "form" };
    case "notFound":
      return { kind: "notFound" };
    default:
      return fallback;
  }
}

/** A part of the content that is not a page: a list edited item by item, or a set of fields. */
export function PartEditor({ part, draft, onActiveItem }: { part: Part; draft: SiteData; onActiveItem: (id: string | null) => void }) {
  if (part.root in rootCollections) {
    const root = part.root as CollectionRoot;
    return (
      <Card>
        <CardHeader title={`${part.label} (${draft[root].order.length})`} description={part.description} />
        <CollectionEditor
          hideLegend
          spec={{ key: root, label: part.label, kind: "collection", item: rootCollections[root] }}
          path={[root]}
          collection={draft[root] as unknown as { order: string[]; items: Record<string, Obj> }}
          draft={draft}
          onOpen={onActiveItem}
        />
      </Card>
    );
  }
  const root = part.root as FieldsRoot;
  return (
    <Card>
      <CardHeader title={part.label} description={part.description} />
      <FieldList fields={rootFields[root]} base={[root]} object={draft[root] as unknown as Obj} draft={draft} />
    </Card>
  );
}
