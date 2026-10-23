// Names changes in plain Swedish, for the version history ("Startsidan › Toppen › Rubrik") and the save indicator.
import { getAt } from "./paths.ts";
import { colorRoleLabels, fontRoleLabels, pageFields, rootCollections, rootFields, rootLabels, sectionFields, sectionTypeLabels, type FieldSpec } from "./labels.ts";
import type { ColorRole, SectionType } from "./schema.ts";

const otherLabels: Record<string, string> = {
  seo: "Sökmotorer",
  title: "Rubrik",
  description: "Beskrivning",
  order: "ordning",
  hidden: "visas eller döljs",
  label: "namn",
  anchor: "ankare",
  name: "Namn",
  shortDescription: "Kort beskrivning",
  slug: "Adress",
  image: "Bild",
  icon: "Symbol",
  phone: "Telefon",
  email: "E-post",
  address: "Adress",
  legalName: "Företagsnamn",
  orgNumber: "Organisationsnummer",
  openingHours: "Öppettider",
  social: "Sociala medier",
  logo: "Logga",
  favicon: "Favikon",
  maintenance: "Underhållsläge",
  analyticsId: "Google Analytics",
};

/** Names the rest of a path inside an object described by `fields`: "Fråga ”Hur lång tid …”" › "Svar". */
function describeIn(doc: unknown, base: string[], fields: FieldSpec[] | undefined, rest: string[]): string[] {
  if (rest.length === 0) return [];
  const [key, ...more] = rest;
  const spec = fields?.find((field) => field.key === key);
  if (!spec) return [otherLabels[key] ?? key];
  if (spec.kind === "collection" && spec.item) {
    if (more[0] === "order" || more.length === 0) return [`${spec.label} (ordning)`];
    if (more[0] === "items" && more[1]) {
      const item = getAt(doc, [...base, key, "items", more[1]]) as Record<string, unknown> | undefined;
      const title = spec.item.titleKey ? String(item?.[spec.item.titleKey] ?? "") : "";
      const name = `${spec.item.label}${title ? ` ”${title.slice(0, 40)}”` : ""}`;
      return [name, ...describeIn(doc, [...base, key, "items", more[1]], spec.item.fields, more.slice(2))];
    }
  }
  if (spec.fields && more.length > 0) return [spec.label, ...describeIn(doc, [...base, key], spec.fields, more)];
  return [spec.label];
}

/** "Startsidan › Toppen › Rubrik" for a path in the document. */
export function describePath(doc: unknown, path: string[]): string {
  const [root, ...rest] = path;
  if (root === "pages" && rest[0] === "items" && rest[1]) {
    const page = getAt(doc, ["pages", "items", rest[1]]) as { title?: string; slug?: string } | undefined;
    const pageName = page?.slug === "" ? "Startsidan" : page?.title || rest[1];
    if (rest[2] === "sections" && rest[3] === "items" && rest[4]) {
      const base = ["pages", "items", rest[1], "sections", "items", rest[4]];
      const section = getAt(doc, base) as { type?: SectionType; label?: string } | undefined;
      const type = section?.type;
      const sectionName = section?.label || (type ? sectionTypeLabels[type]?.label : undefined) || rest[4];
      return [pageName, sectionName, ...describeIn(doc, base, type ? sectionFields[type] : undefined, rest.slice(5))].join(" › ");
    }
    if (rest[2] === "sections") return `${pageName} › sektionernas ordning`;
    if (rest.length === 2) return pageName;
    return [pageName, ...describeIn(doc, ["pages", "items", rest[1]], pageFields, rest.slice(2))].join(" › ");
  }
  const rootName = rootLabels[root] ?? root;
  if (root in rootCollections) {
    const spec = rootCollections[root as keyof typeof rootCollections];
    if (rest[0] === "items" && rest[1]) {
      const item = getAt(doc, [root, "items", rest[1]]) as Record<string, unknown> | undefined;
      const itemName = String(item?.[spec.titleKey] ?? "") || rest[1];
      return [rootName, itemName, ...describeIn(doc, [root, "items", rest[1]], spec.fields, rest.slice(2))].join(" › ");
    }
    return `${rootName} (ordning)`;
  }
  if (root === "theme") {
    const [kind, role] = rest;
    if (kind === "colors" && role) return `Färger › ${colorRoleLabels[role as ColorRole]?.label ?? role}`;
    if (kind === "fonts" && role) return `Typsnitt › ${fontRoleLabels[role as keyof typeof fontRoleLabels] ?? role}`;
    return rootName;
  }
  if (root === "settings" && rest[0] === "logo") return `${rootName} › Logga`;
  const fields = rootFields[root as keyof typeof rootFields];
  return [rootName, ...describeIn(doc, [root], fields, rest)].join(" › ");
}

/** A short summary of several changes: the first few named, the rest counted. */
export function summarize(doc: unknown, paths: string[][], extra: string[] = []): string {
  const names = Array.from(new Set([...extra, ...paths.map((path) => describePath(doc, path))]));
  if (names.length === 0) return "Inga ändringar";
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} och ${names.length - 3} till` : shown;
}
