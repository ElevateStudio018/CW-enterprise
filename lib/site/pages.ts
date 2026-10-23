import { list } from "./collection.ts";
import type { Page, SiteData } from "./schema.ts";

/** Addresses the site itself uses, which a page of its own can never take. */
export const RESERVED_SLUGS = ["admin", "forslag", "tjanster", "photos", "fonts", "cw", "_next", "404", "icon.png", "robots.txt", "sitemap.xml"];

export function homePage(site: SiteData): Page & { id: string } {
  const home = list(site.pages).find((page) => page.slug === "");
  if (!home) throw new Error("The content has no start page");
  return home;
}

export function subpages(site: SiteData): (Page & { id: string })[] {
  return list(site.pages).filter((page) => page.slug !== "");
}

export function pageBySlug(site: SiteData, slug: string): (Page & { id: string }) | undefined {
  return subpages(site).find((page) => page.slug === slug);
}
