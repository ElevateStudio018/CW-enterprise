import { z } from "zod";
import { siteDataSchema, type SiteData } from "./site/schema.ts";
import { describePath } from "./site/changes.ts";

z.config(z.locales.sv());

export interface ContentIssue {
  path: string[];
  where: string;
  message: string;
}

/** Checks a whole document against the content schema, naming each problem the way the admin names the field. */
export function validateSite(doc: unknown): { ok: true; data: SiteData } | { ok: false; issues: ContentIssue[] } {
  const parsed = siteDataSchema.safeParse(doc);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.slice(0, 20).map((issue) => {
      const path = issue.path.map(String);
      return { path, where: describePath(doc, path), message: issue.message };
    }),
  };
}

/** Same document, ignoring key order. */
export function sameDocument(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value !== null && typeof value === "object"
        ? Object.fromEntries(Object.keys(value as object).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]))
        : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
