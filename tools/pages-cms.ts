// Writes .pages.yml, the setup of Pages CMS (app.pagescms.org): the admin where the site's texts and pictures are
// edited and saved straight into content/site.json in this repository. The fields are the admin panel's own
// (lib/site/labels.ts), for the parts and list items the content has now. Pages CMS merges what it saves into the file
// (settings.content.merge), so everything it does not show, such as the order of sections, stays as it is.
//
//   npx tsx tools/pages-cms.ts
import { readFileSync, writeFileSync } from "node:fs";
import { pageFields, rootCollections, rootFields, sectionFields, sectionTypeLabels, type FieldSpec } from "../lib/site/labels.ts";

type Field = Record<string, unknown>;
type Doc = Record<string, any>;

const site: Doc = JSON.parse(readFileSync("content/site.json", "utf8"));
const MEDIA = "photos";

const describe = (spec: FieldSpec) => (spec.hint ? { description: spec.hint } : {});

function imageField(spec: FieldSpec): Field {
  return {
    name: spec.key,
    label: spec.label,
    type: "object",
    ...describe(spec),
    fields: [
      { name: "src", label: "Bild", type: "image", options: { media: MEDIA } },
      { name: "alt", label: "Beskrivning av bilden (för skärmläsare och Google)", type: "string" },
    ],
  };
}

/** One list item per entry the content has now (lists keep their items; new ones are added in the code). */
function collectionField(spec: FieldSpec, value: any): Field {
  const item = spec.item!;
  const ids: string[] = value?.order ?? Object.keys(value?.items ?? {});
  return {
    name: spec.key,
    label: spec.label,
    type: "object",
    ...describe(spec),
    fields: [
      {
        name: "items",
        label: spec.label,
        type: "object",
        fields: ids.map((id, index) => {
          const entry = value.items[id] ?? {};
          const title = String(entry[item.titleKey] ?? "").slice(0, 50);
          return { name: id, label: `${item.label} ${index + 1}${title ? `: ${title}` : ""}`, type: "object", fields: fieldsFor(item.fields, entry) };
        }),
      },
    ],
  };
}

function toField(spec: FieldSpec, value: any): Field | null {
  const base = { name: spec.key, label: spec.label, ...describe(spec) };
  switch (spec.kind) {
    case "text":
    case "href":
    case "slug":
    case "icon":
      return { ...base, type: "string" };
    case "textarea":
      return { ...base, type: "text" };
    case "paragraphs":
      return { ...base, type: "text", list: true };
    case "number":
    case "year":
    case "decimal":
      return { ...base, type: "number" };
    case "toggle":
      return { ...base, type: "boolean" };
    case "select":
      return { ...base, type: "select", options: { values: (spec.options ?? []).map((o) => ({ value: o.value, label: o.label })) } };
    case "link":
    case "optionalLink":
      return { ...base, type: "object", fields: [{ name: "label", label: "Text", type: "string" }, { name: "href", label: "Leder till", type: "string" }] };
    case "image":
    case "optionalImage":
      return imageField(spec);
    case "seo":
      return { ...base, type: "object", fields: fieldsFor(spec.fields ?? [], value) };
    case "group":
      return { ...base, type: "object", fields: fieldsFor(spec.fields ?? [], value) };
    case "collection":
      return value ? collectionField(spec, value) : null;
    default:
      return null;
  }
}

function fieldsFor(specs: FieldSpec[], value: any): Field[] {
  return specs.map((spec) => toField(spec, value?.[spec.key])).filter((f): f is Field => f !== null);
}

/** Wraps fields in the objects leading to them, e.g. ["pages", "items", "hem"]. */
function nest(path: [string, string][], fields: Field[]): Field[] {
  return path.reduceRight<Field[]>((inner, [name, label]) => [{ name, label, type: "object", fields: inner }], fields);
}

const entry = (name: string, label: string, fields: Field[]) => ({ name, label, type: "file", path: "content/site.json", format: "json", fields });

const content: Field[] = [];

for (const pageId of site.pages.order as string[]) {
  const page = site.pages.items[pageId];
  const sections = (page.sections.order as string[]).map((sectionId) => {
    const section = page.sections.items[sectionId];
    const specs = sectionFields[section.type as keyof typeof sectionFields] ?? [];
    const heading = String(section.heading ?? "").slice(0, 50);
    const typeLabel = sectionTypeLabels[section.type as keyof typeof sectionTypeLabels]?.label ?? section.type;
    return { name: sectionId, label: heading ? `${typeLabel}: ${heading}` : typeLabel, type: "object", fields: fieldsFor(specs, section) };
  });
  const fields = [
    ...fieldsFor(pageFields, page),
    { name: "sections", label: "Sektioner", type: "object", fields: [{ name: "items", label: "Sektioner", type: "object", fields: sections }] },
  ];
  content.push(entry(`sida-${pageId}`, `Sida: ${page.title || pageId}`, nest([["pages", "Sidor"], ["items", "Sidor"], [pageId, page.title || pageId]], fields)));
}

for (const [key, label] of [["services", "Tjänster"], ["uppdrag", "Projektkort"], ["certificates", "Certifikat"]] as const) {
  if (!site[key]) continue;
  const item = rootCollections[key];
  content.push(entry(key, label, [collectionField({ key, label, kind: "collection", item }, site[key])]));
}

for (const [key, label] of [
  ["company", "Företagsuppgifter"],
  ["navigation", "Meny"],
  ["footer", "Sidfot"],
  ["form", "Offertformulär"],
  ["servicePage", "Tjänstesidornas texter"],
] as const) {
  content.push(entry(key, label, [{ name: key, label, type: "object", fields: fieldsFor(rootFields[key], site[key]) }]));
}

const config = {
  media: [{ name: MEDIA, label: "Bilder", input: "public/photos/uploads", output: "/photos/uploads", rename: "safe", categories: ["image"] }],
  settings: { content: { merge: true }, commit: { identity: "user" } },
  content,
};

// JSON is valid YAML, and keeps the generated file free of quoting surprises.
writeFileSync(".pages.yml", "# Generated by tools/pages-cms.ts from content/site.json and lib/site/labels.ts. Do not edit by hand.\n" + JSON.stringify(config, null, 1) + "\n");
console.log(`.pages.yml: ${content.length} entries`);
