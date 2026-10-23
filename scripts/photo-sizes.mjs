// Makes smaller copies of the photos in public/photos (480, 800 and 1200 px wide, where the photo is wider) and lists
// every photo's widths in lib/photo-sizes.json, for lib/photos.ts to build each photo's srcset from.
// Run after adding or replacing a photo: npm run photos
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = "public/photos";
const WIDTHS = [480, 800, 1200];
const isCopy = (file) => /-\d+\.webp$/.test(file);

const widths = {};
for (const file of (await readdir(DIR)).filter((f) => f.endsWith(".webp") && !isCopy(f)).sort()) {
  const name = file.replace(/\.webp$/, "");
  const input = path.join(DIR, file);
  const { width } = await sharp(input).metadata();
  const smaller = WIDTHS.filter((w) => w < width);
  for (const w of smaller) {
    const info = await sharp(input).resize({ width: w }).webp({ quality: 80 }).toFile(path.join(DIR, `${name}-${w}.webp`));
    console.log(`${name}-${w}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
  }
  widths[name] = [...smaller, width];
}
await writeFile("lib/photo-sizes.json", JSON.stringify(widths, null, 2) + "\n");
console.log(`lib/photo-sizes.json: ${Object.keys(widths).length} photos`);
