// Minimal static build: injects shared partials into each page and copies assets to dist/.
// Usage: node build.mjs
import { readFile, writeFile, readdir, mkdir, cp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const out = join(root, 'dist');

const partials = {};
for (const f of await readdir(join(src, 'partials'))) {
  partials[f.replace(/\.html$/, '')] = await readFile(join(src, 'partials', f), 'utf8');
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const year = new Date().getFullYear();

for (const f of await readdir(join(src, 'pages'))) {
  if (!f.endsWith('.html')) continue;
  let html = await readFile(join(src, 'pages', f), 'utf8');
  const page = (html.match(/data-page="([^"]+)"/) || [])[1] || '';

  html = html.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Unknown partial "${name}" in ${f}`);
    return partials[name];
  });

  // Mark the active navigation item, and its parent group.
  html = html.replace(/data-nav="([^"]+)"/g, (m, key) => {
    const keys = key.split(' ');
    return keys.includes(page) ? `${m} aria-current="page"` : m;
  });
  html = html.replaceAll('{{year}}', String(year));

  await writeFile(join(out, f), html);
}

await cp(join(root, 'assets'), join(out, 'assets'), { recursive: true });
for (const f of ['robots.txt', 'sitemap.xml']) {
  await cp(join(root, f), join(out, f)).catch(() => {});
}
console.log('Built to dist/');
