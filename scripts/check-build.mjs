// Checks a finished static build (out/) before it is published: every page's local links, scripts, styles and images
// must point at files that exist in the build, and no page may link to the wrong host. Run by the deploy workflow and
// by hand: node scripts/check-build.mjs out
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const dir = process.argv[2] ?? "out";
const basePath = process.env.SITE_BASE_PATH ?? (process.env.SITE_DOMAIN ? "" : "/CW-enterprise");
const siteUrl = process.env.SITE_URL ?? "";

function* walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const problems = [];
let pages = 0;
let refs = 0;
for (const file of walk(dir)) {
  if (!file.endsWith(".html") && !file.endsWith(".xml") && !file.endsWith(".txt")) continue;
  const html = readFileSync(file, "utf8");
  const page = relative(dir, file);
  if (file.endsWith(".html")) pages++;
  for (const match of html.matchAll(/(?:href|src|srcset|content)="([^"]+)"/g)) {
    for (const raw of match[1].split(",")) {
      const value = raw.trim().split(/\s+/)[0];
      if (!value.startsWith("/") || value.startsWith("//")) continue;
      refs++;
      if (basePath && !value.startsWith(basePath + "/") && value !== basePath) {
        problems.push(`${page}: "${value}" is outside the base path ${basePath}`);
        continue;
      }
      let target = decodeURIComponent(value.slice(basePath.length).split(/[?#]/)[0]);
      if (target === "" || target === "/") target = "/index.html";
      const candidates = [join(dir, target), join(dir, target, "index.html"), join(dir, target + ".html")];
      if (!candidates.some((c) => existsSync(c) && !statSync(c).isDirectory())) problems.push(`${page}: "${value}" does not exist in the build`);
    }
  }
  if (siteUrl) {
    const wrong = html.match(/https:\/\/elevatestudio018\.github\.io\/CW-enterprise[^"'<\s]*/);
    if (wrong) problems.push(`${page}: still names the preview address ${wrong[0]}`);
  }
}

if (basePath === "" && !existsSync(join(dir, "CNAME"))) problems.push("built for the root but out/CNAME is missing");
if (!existsSync(join(dir, "404.html"))) problems.push("404.html is missing (GitHub Pages uses it for unknown addresses)");

console.log(`check-build: ${pages} pages, ${refs} local references, base path "${basePath}"${siteUrl ? `, site ${siteUrl}` : ""}`);
if (problems.length) {
  console.error(problems.slice(0, 40).join("\n"));
  console.error(`check-build: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("check-build: ok");
