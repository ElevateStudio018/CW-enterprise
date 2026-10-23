import type { SiteData, SiteImage } from "@/lib/site/schema.ts";
import { describePath } from "@/lib/site/changes.ts";
import { getAt } from "@/lib/site/paths.ts";
import { pageFields, rootCollections, rootFields, sectionFields, type FieldSpec } from "@/lib/site/labels.ts";

export interface ImageUsage {
  path: string[];
  image: SiteImage;
  where: string;
}

function isImage(value: unknown): value is SiteImage {
  return Boolean(value && typeof value === "object" && "src" in value && "variants" in value && "alt" in value);
}

/** Every image the content uses, with where it is shown. Hidden sections count too: they can be shown again. */
export function findImages(draft: SiteData): ImageUsage[] {
  const found: ImageUsage[] = [];
  function walk(node: unknown, path: string[]) {
    if (isImage(node)) {
      found.push({ path, image: node, where: describePath(draft, path) });
      return;
    }
    if (node && typeof node === "object" && !Array.isArray(node)) {
      for (const [key, value] of Object.entries(node)) walk(value, [...path, key]);
    }
  }
  walk(draft, []);
  // The logo is an image too, when one has been uploaded.
  return found.map((usage) => (usage.path.join(".") === "settings.logo.image" ? { ...usage, where: "Logga" } : usage));
}

/** Where an uploaded image is used. */
export function usagesOf(draft: SiteData, imageId: string): ImageUsage[] {
  return findImages(draft).filter((usage) => usage.image.imageId === imageId);
}

/** The field an image sits in, found by walking the field descriptions along its path (for its crop and label). */
export function imageFieldAt(draft: SiteData, path: string[]): FieldSpec | undefined {
  const [root, ...rest] = path;
  let fields: FieldSpec[] | undefined;
  let remaining: string[] = [];
  if (root === "pages" && rest[0] === "items") {
    if (rest[2] === "sections" && rest[3] === "items" && rest[4]) {
      const section = getAt(draft, ["pages", "items", rest[1], "sections", "items", rest[4]]) as { type?: keyof typeof sectionFields } | undefined;
      fields = section?.type ? sectionFields[section.type] : undefined;
      remaining = rest.slice(5);
    } else {
      fields = pageFields;
      remaining = rest.slice(2);
    }
  } else if (root in rootCollections && rest[0] === "items") {
    fields = rootCollections[root as keyof typeof rootCollections].fields;
    remaining = rest.slice(2);
  } else if (root === "settings" && rest[0] === "logo") {
    return { key: "image", label: "Logga", kind: "image", imageUsage: "logo" };
  } else {
    fields = rootFields[root as keyof typeof rootFields];
    remaining = rest;
  }
  while (fields && remaining.length > 0) {
    const [key, ...more] = remaining;
    const spec: FieldSpec | undefined = fields.find((field) => field.key === key);
    if (!spec) return undefined;
    if (more.length === 0) return spec;
    if (spec.kind === "collection" && more[0] === "items") {
      fields = spec.item?.fields;
      remaining = more.slice(2);
    } else {
      fields = spec.fields;
      remaining = more;
    }
  }
  return undefined;
}
