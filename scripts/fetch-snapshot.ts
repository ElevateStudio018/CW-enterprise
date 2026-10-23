// Runs before every build and dev start (npm prebuild/predev): writes content/snapshot.json, the content the site is
// built from. When the site is connected to Supabase that is the published snapshot there; without a connection it is
// the original content (content/baseline.json). A connected build that cannot fetch or validate the snapshot fails
// rather than publishing anything else, so the live site keeps its last good version.
import { readFileSync, writeFileSync } from "node:fs";
import { siteDataSchema, type SiteData } from "../lib/site/schema.ts";
import { downloadFonts } from "./fonts.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const out = "content/snapshot.json";
const fontsOut = "content/fonts.json";

/** The theme's own fonts, downloaded for the site to serve itself (see scripts/fonts.ts). */
async function writeFonts(site: SiteData) {
  writeFileSync(fontsOut, JSON.stringify(await downloadFonts(site)));
}

async function fetchPublished(): Promise<{ version: number; data: unknown }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(`${url}/rest/v1/site_snapshot?select=version,data&id=eq.1`, {
        headers: { apikey: key!, Authorization: `Bearer ${key}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const rows = (await response.json()) as { version: number; data: unknown }[];
      if (rows.length !== 1) throw new Error("No published snapshot");
      return rows[0];
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 500));
    }
  }
  throw lastError;
}

async function main() {
  if (!url || !key) {
    const baseline = siteDataSchema.parse(JSON.parse(readFileSync("content/baseline.json", "utf8")));
    writeFileSync(out, JSON.stringify(baseline));
    await writeFonts(baseline);
    console.log("snapshot: not connected to Supabase, using content/baseline.json");
    return;
  }

  const { version, data } = await fetchPublished();
  const parsed = siteDataSchema.safeParse(data);
  if (!parsed.success) {
    console.error("snapshot: the published content does not match the schema:", parsed.error.issues.slice(0, 10));
    process.exit(1);
  }
  writeFileSync(out, JSON.stringify(parsed.data));
  await writeFonts(parsed.data);
  // The admin compares this with the published version to tell when the new site is live.
  writeFileSync("public/site-version.json", JSON.stringify({ version }));
  console.log(`snapshot: published version ${version} from Supabase`);
}

main().catch((error) => {
  console.error("snapshot: could not fetch the published content:", error);
  process.exit(1);
});
