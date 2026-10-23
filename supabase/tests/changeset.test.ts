// The AI's change sets without the model: applying operations, catching mistakes and pricing what they contain.
// Run: npx tsx supabase/tests/changeset.test.ts
import assert from "node:assert/strict";
import baseline from "../../content/baseline.json";
import { siteDataSchema } from "../../lib/site/schema.ts";
import { applyChangeSet, imagesBySrc, priceChangeSet, type Operation } from "../../lib/site/changeset.ts";
import { newSection } from "../../lib/admin/templates.ts";

const site = siteDataSchema.parse(baseline);
const known = imagesBySrc(site);
const results: [string, string, string?][] = [];
function test(name: string, body: () => void) {
  try {
    body();
    results.push(["ok", name]);
  } catch (error) {
    results.push(["FAIL", name, (error as Error).message]);
  }
}
const run = (operations: Operation[]) => {
  const applied = applyChangeSet(site, operations, known);
  assert.deepEqual(applied.problems, [], applied.problems.join("\n"));
  return { applied, price: priceChangeSet(site, applied.doc!, operations) };
};
const sections = ["pages", "items", "om-oss", "sections"];

test("a new advanced section costs 20, and its own items are not counted again", () => {
  const team = { ...newSection("team"), hidden: false, heading: "Vi som jobbar här", members: { order: ["anna"], items: { anna: { name: "Anna", role: "Projektledare", phone: "", email: "", image: null } } } };
  const { price } = run([{ op: "insert", path: sections, id: "teamet", place: "last", afterId: "", itemJson: JSON.stringify(team) }]);
  assert.deepEqual(price.lines.map((line) => line.credits), [20]);
});

test("a new standard section costs 15", () => {
  const cta = { ...newSection("cta"), hidden: false, heading: "Behöver du hjälp med marken?", text: "Ring oss.", button: { label: "Begär offert", href: "#offert" } };
  const { price } = run([{ op: "insert", path: sections, id: "uppmaning", place: "first", afterId: "", itemJson: JSON.stringify(cta) }]);
  assert.equal(price.total, 15);
});

test("three new FAQ questions cost 5 each", () => {
  const path = ["pages", "items", "hem", "sections", "items", "fragor", "items"];
  const ops: Operation[] = [1, 2, 3].map((n) => ({ op: "insert", path, id: `ny-${n}`, place: "last", afterId: "", itemJson: JSON.stringify({ question: `Fråga ${n}?`, answer: "Svar." }) }));
  assert.equal(run(ops).price.total, 15);
});

test("a heading is a minor change (1); rewriting a section's texts costs 3", () => {
  const hero = ["pages", "items", "hem", "sections", "items", "hero"];
  assert.equal(run([{ op: "set", path: [...hero, "heading"], valueJson: JSON.stringify("Badrum i Göteborg") }]).price.total, 1);
  const about = ["pages", "items", "hem", "sections", "items", "om-oss"];
  const rewrite: Operation[] = [
    { op: "set", path: [...about, "heading"], valueJson: JSON.stringify("Om Västkust Bygg") },
    { op: "set", path: [...about, "subheading"], valueJson: JSON.stringify("Vi har gjort mark- och grundarbeten sedan 2002.") },
    { op: "set", path: [...about, "text"], valueJson: JSON.stringify("Ny text om företaget.") },
  ];
  assert.equal(run(rewrite).price.total, 3);
});

test("colours cost 2 however many change; a page's SEO costs 8", () => {
  const ops: Operation[] = [
    { op: "set", path: ["theme", "colors", "button"], valueJson: JSON.stringify("#0F1A0C") },
    { op: "set", path: ["theme", "colors", "buttonHover"], valueJson: JSON.stringify("#0A1208") },
  ];
  assert.equal(run(ops).price.total, 2);
  const seo: Operation[] = [
    { op: "set", path: ["pages", "items", "om-oss", "seo", "title"], valueJson: JSON.stringify("Om oss – markentreprenör i Kungälv") },
    { op: "set", path: ["pages", "items", "om-oss", "seo", "description"], valueJson: JSON.stringify("Västkust Bygg bygger och renoverar i Göteborg och Kungsbacka.") },
  ];
  assert.equal(run(seo).price.total, 8);
});

test("mistakes are reported instead of applied: unknown ids, broken links, invented images, bad values", () => {
  const faq = ["pages", "items", "hem", "sections", "items", "fragor", "items"];
  const problems = (ops: Operation[]) => applyChangeSet(site, ops, known).problems.join(" ");
  assert.match(problems([{ op: "remove", path: faq, id: "finns-inte" }]), /no item "finns-inte"/);
  assert.match(problems([{ op: "set", path: ["pages", "items", "hem", "sections", "items", "hero", "button", "href"], valueJson: JSON.stringify("/finns-inte") }]), /leads to a page/);
  assert.match(
    problems([{ op: "set", path: ["pages", "items", "hem", "sections", "items", "hero", "image"], valueJson: JSON.stringify({ src: "https://example.com/x.jpg", alt: "x" }) }]),
    /not one of the site's images/
  );
  assert.match(problems([{ op: "set", path: ["theme", "colors", "button"], valueJson: JSON.stringify("svart") }]), /theme\.colors\.button/);
  assert.match(problems([{ op: "set", path: ["schemaVersion"], valueJson: "2" }]), /schemaVersion/);
});

test("an existing image can be reused by its src; its size variants come back", () => {
  const hero = site.pages.items.hem.sections.items.hero;
  if (hero.type !== "hero") throw new Error("hero expected");
  const path = ["pages", "items", "om-oss", "sections", "items", "bild", "image"];
  const { applied } = run([{ op: "set", path, valueJson: JSON.stringify({ src: hero.image.src, alt: "Två arbetare vid en byggarbetsplats" }) }]);
  const image = (applied.doc!.pages.items["om-oss"].sections.items.bild as { image: { variants: unknown[]; alt: string } }).image;
  assert.equal(image.variants.length, hero.image.variants.length);
  assert.equal(image.alt, "Två arbetare vid en byggarbetsplats");
});

test("content read back from the database (keys sorted) prices only what changed", () => {
  const sortKeys = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sortKeys)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]))
        : value;
  const fromDatabase = sortKeys(site) as typeof site;
  const op: Operation = { op: "insert", path: ["pages", "items", "hem", "sections", "items", "fragor", "items"], id: "ny", place: "last", afterId: "", itemJson: JSON.stringify({ question: "Fråga?", answer: "Svar." }) };
  const applied = applyChangeSet(fromDatabase, [op], imagesBySrc(fromDatabase));
  assert.deepEqual(applied.problems, []);
  const price = priceChangeSet(fromDatabase, applied.doc!, [op]);
  assert.deepEqual(price.lines.map((line) => line.credits), [5]);
});

for (const [status, name, message] of results) console.log(status.padEnd(4), name, message ? `— ${message}` : "");
const failed = results.filter(([status]) => status === "FAIL").length;
console.log(failed ? `${failed} failed` : `all ${results.length} passed`);
process.exit(failed ? 1 : 0);
