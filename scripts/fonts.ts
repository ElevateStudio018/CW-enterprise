// The fonts the owner has chosen (other than Figtree, which the site bundles), downloaded from Google Fonts while the
// site is built so that it serves its own copies: visitors' browsers never contact Google, and the text is drawn in
// the right font from the first paint. Only the Latin subset is kept; it covers Swedish (å, ä, ö, é …).
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fontOption, googleFontsHref } from "../lib/site/fonts.ts";
import type { SiteData } from "../lib/site/schema.ts";

export interface FontFace {
  family: string;
  style: string;
  weight: string;
  /** The file's address on the site, without the base path. */
  src: string;
  unicodeRange: string;
}

// Google Fonts answers with WOFF2 files to browsers that can read them.
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const slug = (family: string) => family.toLowerCase().replace(/[^a-z0-9]+/g, "-");

async function get(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }
  }
  throw lastError;
}

/**
 * Downloads the theme's fonts into publicDir and describes them for the site's @font-face rules. A font that cannot be
 * downloaded is skipped with a warning: the site then shows a similar system font rather than failing to build.
 */
export async function downloadFonts(site: SiteData, publicDir = "public/fonts"): Promise<FontFace[]> {
  rmSync(publicDir, { recursive: true, force: true });
  const families = Array.from(new Set(Object.values(site.theme.fonts).map((font) => font.family))).filter((family) => family !== "Figtree");
  if (families.length === 0) return [];
  mkdirSync(publicDir, { recursive: true });

  const faces: FontFace[] = [];
  const saved = new Map<string, string>();
  for (const family of families) {
    if (!fontOption(family)) {
      console.warn(`fonts: "${family}" is not one of the offered Google Fonts; skipped`);
      continue;
    }
    try {
      const css = await (await get(googleFontsHref([family]))).text();
      for (const match of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
        if (match[1] !== "latin") continue;
        const block = match[2];
        const property = (name: string) => block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
        const url = block.match(/url\(([^)]+)\)/)?.[1]?.replace(/["']/g, "");
        if (!url) continue;
        let file = saved.get(url);
        if (!file) {
          file = `${slug(family)}-${createHash("sha256").update(url).digest("hex").slice(0, 10)}.woff2`;
          writeFileSync(`${publicDir}/${file}`, Buffer.from(await (await get(url)).arrayBuffer()));
          saved.set(url, file);
        }
        faces.push({
          family,
          style: property("font-style") ?? "normal",
          weight: property("font-weight") ?? "400",
          src: `/fonts/${file}`,
          unicodeRange: property("unicode-range") ?? "",
        });
      }
    } catch (error) {
      console.warn(`fonts: could not download "${family}"; the site falls back to a similar system font`, error);
    }
  }
  console.log(`fonts: ${faces.length} font files for ${families.join(", ")}`);
  return faces;
}
