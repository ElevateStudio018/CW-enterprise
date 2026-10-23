// Starting points for new content: a list item or a whole section with every field empty or at its first choice.
// New sections start hidden, so nothing half-written reaches the site before the owner switches it on.
import { contentIcons, sectionSchema, type Link, type Section, type SectionType, type SiteImage } from "@/lib/site/schema.ts";
import { sectionFields, type FieldSpec } from "@/lib/site/labels.ts";

type Obj = Record<string, unknown>;

export function emptyItem(fields: FieldSpec[], image?: SiteImage): Obj {
  const item: Obj = {};
  for (const field of fields) {
    switch (field.kind) {
      case "text":
      case "textarea":
      case "slug":
        item[field.key] = "";
        break;
      case "paragraphs":
        item[field.key] = [];
        break;
      case "link":
        item[field.key] = { label: "", href: "#offert" } satisfies Link;
        break;
      case "href":
        item[field.key] = "#offert";
        break;
      case "optionalLink":
      case "optionalImage":
        item[field.key] = null;
        break;
      case "image":
        item[field.key] = image;
        break;
      case "number":
      case "year":
      case "decimal":
        item[field.key] = field.min !== undefined && field.min > 0 ? field.min : 0;
        break;
      case "icon":
        item[field.key] = contentIcons[0];
        break;
      case "select":
        item[field.key] = field.options?.[0]?.value ?? "";
        break;
      case "toggle":
        item[field.key] = false;
        break;
      case "collection":
        item[field.key] = { order: [], items: {} };
        break;
      case "seo":
        item[field.key] = { title: "", description: "" };
        break;
      case "group":
        item[field.key] = emptyItem(field.fields ?? []);
        break;
    }
  }
  return item;
}

/** Whether a new section of this type needs a picture before it can exist. */
export function needsImage(type: SectionType): boolean {
  return sectionFields[type].some((field) => field.kind === "image");
}

/** A new, hidden section of a type; `image` fills its required picture. */
export function newSection(type: SectionType, image?: SiteImage): Section {
  const content = emptyItem(sectionFields[type], image);
  if (type === "map") content.zoom = 11;
  return sectionSchema.parse({ type, hidden: true, anchor: "", label: "", ...content });
}

/** The section types in the order the "add" dialog offers them. */
export const sectionChoices: { group: string; types: SectionType[] }[] = [
  { group: "Text och uppmaningar", types: ["text", "cta", "faq", "process", "values", "timeline", "model", "testimonials", "stats", "pricelist", "team"] },
  { group: "Bilder", types: ["gallery", "beforeAfter", "overlay", "pageHero", "hero", "about", "photoPair", "band", "feature", "promo"] },
  { group: "Innehåll från andra delar", types: ["services", "uppdragGrid", "certificates", "contact", "area", "map", "uppdragCarousel", "aboutIntro"] },
];
