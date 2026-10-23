// Database checks against the local Supabase (supabase start): roles, row level security, saving, conflicts,
// publishing, restoring and the service-role-only functions. Run: node supabase/tests/db.test.mjs
import assert from "node:assert/strict";

const API = process.env.API_URL ?? "http://127.0.0.1:54321";
// The local stack's keys, from `supabase status -o env` (see supabase/tests/README.md).
const ANON = process.env.ANON_KEY;
const SERVICE = process.env.SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) throw new Error("Run with the local keys: eval \"$(supabase status -o env)\" first");

async function call(path, { method = "GET", token, key = ANON, body, headers = {} } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : key === SERVICE ? { Authorization: `Bearer ${SERVICE}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, json };
}

const rpc = (fn, args, opts) => call(`/rest/v1/rpc/${fn}`, { method: "POST", body: args, ...opts });

async function user(email, password) {
  await call("/auth/v1/admin/users", { method: "POST", key: SERVICE, body: { email, password, email_confirm: true } });
  const { json } = await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  assert.ok(json.access_token, `login ${email}: ${JSON.stringify(json)}`);
  return json.access_token;
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(["ok", name]);
  } catch (error) {
    results.push(["FAIL", name, error.message]);
  }
}

const suffix = Date.now();
// During the preview Elevate Studio is the allowlisted admin (see the preview_admin migration).
const admin = await user("elevate.studio018@gmail.com", "Testlösen0rd!ABC");
const outsider = await user(`someone-${suffix}@example.com`, "Testlösen0rd!ABC");

await test("allowlisted address becomes admin, others do not", async () => {
  assert.equal((await rpc("is_admin", {}, { token: admin })).json, true);
  assert.equal((await rpc("is_admin", {}, { token: outsider })).json, false);
  // The customer is added at launch, not before.
  const customer = await user("info@cwenterprise.se", "Testlösen0rd!ABC");
  assert.equal((await rpc("is_admin", {}, { token: customer })).json, false);
});

await test("anyone reads the published snapshot", async () => {
  const { status, json } = await call("/rest/v1/site_snapshot?select=version,data->schemaVersion&id=eq.1");
  assert.equal(status, 200);
  assert.equal(json.length, 1);
});

await test("non-admins see none of the admin tables", async () => {
  for (const table of ["website_content", "quote_requests", "site_suggestions", "content_revisions", "credit_balance", "audit_log", "settings", "profiles"]) {
    const { json } = await call(`/rest/v1/${table}?select=*`, { token: outsider });
    assert.deepEqual(json, [], table);
  }
  const draft = await rpc("content_draft", {}, { token: outsider });
  assert.notEqual(draft.status, 200);
});

let draft;
await test("admin opens the draft", async () => {
  const { status, json } = await rpc("content_draft", {}, { token: admin });
  assert.equal(status, 200, JSON.stringify(json));
  assert.equal(json.version >= 1, true);
  assert.equal(json.changes, 0);
  draft = json;
});

const heroPath = ["pages", "items", "hem", "sections", "items", "hero", "heading"];

await test("a save shows in the draft but not on the site", async () => {
  const saved = await rpc("save_content_patch", { p_path: heroPath, p_value: "Ny rubrik", p_known_at: draft.knownAt, p_base_version: draft.version, p_client_id: "tab-a" }, { token: admin });
  assert.equal(saved.json.status, "saved", JSON.stringify(saved.json));
  const now = (await rpc("content_draft", {}, { token: admin })).json;
  assert.equal(now.draft.pages.items.hem.sections.items.hero.heading, "Ny rubrik");
  assert.equal(now.changes, 1);
  const published = (await call("/rest/v1/site_snapshot?select=data&id=eq.1")).json[0].data;
  assert.notEqual(published.pages.items.hem.sections.items.hero.heading, "Ny rubrik");
});

await test("the same tab saving again is no conflict", async () => {
  const saved = await rpc("save_content_patch", { p_path: heroPath, p_value: "Ny rubrik 2", p_known_at: draft.knownAt, p_base_version: draft.version, p_client_id: "tab-a" }, { token: admin });
  assert.equal(saved.json.status, "saved");
});

await test("another device's change to the same part is a conflict", async () => {
  const other = await rpc("save_content_patch", { p_path: heroPath, p_value: "Från tab B", p_known_at: draft.knownAt, p_base_version: draft.version, p_client_id: "tab-b" }, { token: admin });
  assert.equal(other.json.status, "conflict");
  assert.equal(other.json.serverValue, "Ny rubrik 2");
  const forced = await rpc("save_content_patch", { p_path: heroPath, p_value: "Från tab B", p_known_at: draft.knownAt, p_base_version: draft.version, p_client_id: "tab-b", p_force: true }, { token: admin });
  assert.equal(forced.json.status, "saved");
});

await test("a change to a part inside a changed part is a conflict for the other device", async () => {
  const parent = ["pages", "items", "hem", "sections", "items", "hero"];
  const res = await rpc("save_content_patch", { p_path: parent.concat("eyebrow"), p_value: "x", p_known_at: draft.knownAt, p_client_id: "tab-a" }, { token: admin });
  // tab-b wrote the heading (a sibling), so the eyebrow is free
  assert.equal(res.json.status, "saved");
});

await test("setting a field back to what is published leaves nothing to publish", async () => {
  const path = ["pages", "items", "hem", "sections", "items", "faq", "heading"];
  const published = (await call("/rest/v1/site_snapshot?select=data&id=eq.1")).json[0].data.pages.items.hem.sections.items.faq.heading;
  const before = (await rpc("content_draft", {}, { token: admin })).json.changes;
  await rpc("save_content_patch", { p_path: path, p_value: "Tillfällig rubrik", p_client_id: "tab-a" }, { token: admin });
  assert.equal((await rpc("content_draft", {}, { token: admin })).json.changes, before + 1);
  const back = await rpc("save_content_patch", { p_path: path, p_value: published, p_client_id: "tab-a" }, { token: admin });
  assert.equal(back.json.status, "saved", JSON.stringify(back.json));
  const after = (await rpc("content_draft", {}, { token: admin })).json;
  assert.equal(after.changes, before);
  assert.equal(after.draft.pages.items.hem.sections.items.faq.heading, published);
});

await test("the theme cannot be written through content saves", async () => {
  const res = await rpc("save_content_patch", { p_path: ["theme", "colors", "primary"], p_value: "#000000", p_client_id: "tab-a" }, { token: admin });
  assert.notEqual(res.status, 200);
});

await test("colours are saved to the draft theme", async () => {
  const res = await rpc("save_theme_color", { p_scope: "site", p_key: "primary", p_value: "#112233" }, { token: admin });
  assert.equal(res.json.status, "saved", JSON.stringify(res.json));
  const now = (await rpc("content_draft", {}, { token: admin })).json;
  assert.equal(now.draft.theme.colors.primary, "#112233");
  assert.equal(now.themeChanged, true);
});

await test("publishing needs the current marker, then clears the changes", async () => {
  const stale = await rpc("publish_draft", { p_marker: "old", p_summary: "x" }, { token: admin });
  assert.equal(stale.json.status, "changed");
  const now = (await rpc("content_draft", {}, { token: admin })).json;
  const published = await rpc("publish_draft", { p_marker: now.marker, p_summary: "Rubrik och färg" }, { token: admin });
  assert.equal(published.json.status, "published", JSON.stringify(published.json));
  const after = (await rpc("content_draft", {}, { token: admin })).json;
  assert.equal(after.changes, 0);
  assert.equal(after.version, published.json.version);
  const site = (await call("/rest/v1/site_snapshot?select=data&id=eq.1")).json[0].data;
  assert.equal(site.pages.items.hem.sections.items.hero.heading, "Från tab B");
  assert.equal(site.theme.colors.primary, "#112233");
});

await test("non-admins cannot publish", async () => {
  const res = await rpc("publish_draft", { p_marker: "x", p_summary: "x" }, { token: outsider });
  assert.notEqual(res.json?.status, "published");
});

await test("an edit based on an older published version that changed there is a conflict", async () => {
  const res = await rpc("save_content_patch", { p_path: heroPath, p_value: "Gammal grund", p_known_at: draft.knownAt, p_base_version: draft.version, p_client_id: "tab-c" }, { token: admin });
  assert.equal(res.json.status, "conflict");
});

await test("restoring the first version publishes it as a new version", async () => {
  const list = (await rpc("revision_list", {}, { token: admin })).json;
  const first = list.find((r) => r.source === "baseline");
  assert.ok(first);
  const res = await rpc("restore_revision", { p_revision_id: first.id }, { token: admin });
  assert.equal(res.json.status, "published");
  const site = (await call("/rest/v1/site_snapshot?select=data&id=eq.1")).json[0].data;
  assert.equal(site.theme.colors.primary, "#1C2817");
  const draftNow = (await rpc("content_draft", {}, { token: admin })).json;
  assert.equal(draftNow.draft.theme.colors.primary, "#1C2817");
});

await test("the history cannot be changed, not even by the service role", async () => {
  const res = await call("/rest/v1/content_revisions?id=gt.0", { method: "DELETE", key: SERVICE });
  assert.notEqual(res.status, 204);
});

await test("service-role-only functions are closed to signed-in users", async () => {
  for (const [fn, args] of [
    ["credits_topup", { p_pack: 50, p_credits: 50, p_price: 0, p_actor: null }],
    ["insert_quote_request", { p_name: "a", p_phone: "", p_email: "", p_work_type: "", p_message: "", p_sender_hash: "x" }],
    ["insert_site_suggestion", { p_name: "a", p_area: "", p_message: "abc", p_sender_hash: "x" }],
    ["record_login", { p_email_hash: "x", p_ip_hash: "y", p_success: true }],
  ]) {
    const res = await rpc(fn, args, { token: admin });
    assert.ok(res.status === 401 || res.status === 403 || res.status === 404, `${fn}: ${res.status}`);
  }
});

await test("quote requests: service role inserts with a rate limit, admins mark them read", async () => {
  for (let i = 0; i < 5; i++) {
    const res = await rpc("insert_quote_request", { p_name: `Test ${i}`, p_phone: "031-1", p_email: "", p_work_type: "Dränering", p_message: "Hej", p_sender_hash: `s-${suffix}` }, { key: SERVICE });
    assert.equal(res.json.status, "saved");
  }
  const limited = await rpc("insert_quote_request", { p_name: "Test 6", p_phone: "", p_email: "", p_work_type: "", p_message: "", p_sender_hash: `s-${suffix}` }, { key: SERVICE });
  assert.equal(limited.json.status, "rate_limited");
  const rows = (await call(`/rest/v1/quote_requests?select=id,status&order=created_at.desc&limit=1`, { token: admin })).json;
  const upd = await call(`/rest/v1/quote_requests?id=eq.${rows[0].id}`, { method: "PATCH", token: admin, body: { status: "read" } });
  assert.equal(upd.status, 204);
  const tamper = await call(`/rest/v1/quote_requests?id=eq.${rows[0].id}`, { method: "PATCH", token: admin, body: { message: "ändrad" } });
  assert.notEqual(tamper.status, 204);
});

await test("staff suggestions: service role inserts with a rate limit, admins mark and delete, nobody rewrites", async () => {
  for (let i = 0; i < 3; i++) {
    const res = await rpc("insert_site_suggestion", { p_name: `Medarbetare ${i}`, p_area: "Startsidan", p_message: "Bättre bilder", p_sender_hash: `g-${suffix}`, p_max_per_hour: 3 }, { key: SERVICE });
    assert.equal(res.json.status, "saved", JSON.stringify(res.json));
  }
  const limited = await rpc("insert_site_suggestion", { p_name: "Medarbetare 4", p_area: "", p_message: "En till", p_sender_hash: `g-${suffix}`, p_max_per_hour: 3 }, { key: SERVICE });
  assert.equal(limited.json.status, "rate_limited");
  const anonymous = await call("/rest/v1/site_suggestions?select=*");
  assert.deepEqual(anonymous.json, []);
  const insert = await call("/rest/v1/site_suggestions", { method: "POST", token: admin, body: { name: "x", message: "direkt" } });
  assert.notEqual(insert.status, 201);
  const rows = (await call(`/rest/v1/site_suggestions?select=id,status&name=eq.Medarbetare%200`, { token: admin })).json;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "new");
  const done = await call(`/rest/v1/site_suggestions?id=eq.${rows[0].id}`, { method: "PATCH", token: admin, body: { status: "done" } });
  assert.equal(done.status, 204);
  const tamper = await call(`/rest/v1/site_suggestions?id=eq.${rows[0].id}`, { method: "PATCH", token: admin, body: { message: "ändrad" } });
  assert.notEqual(tamper.status, 204);
  const outsiderDelete = await call(`/rest/v1/site_suggestions?id=eq.${rows[0].id}`, { method: "DELETE", token: outsider, headers: { Prefer: "return=representation" } });
  assert.deepEqual(outsiderDelete.json, []);
  const removed = await call(`/rest/v1/site_suggestions?id=eq.${rows[0].id}`, { method: "DELETE", token: admin, headers: { Prefer: "return=representation" } });
  assert.equal(removed.json.length, 1);
});

await test("credits: top-ups add, the fourth in a day waits for approval", async () => {
  const before = (await call("/rest/v1/credit_balance?select=balance", { token: admin })).json[0].balance;
  for (let i = 0; i < 3; i++) {
    const res = await rpc("credits_topup", { p_pack: 50, p_credits: 50, p_price: 0, p_actor: null }, { key: SERVICE });
    assert.equal(res.json.status, "completed", JSON.stringify(res.json));
  }
  const fourth = await rpc("credits_topup", { p_pack: 50, p_credits: 50, p_price: 0, p_actor: null }, { key: SERVICE });
  assert.equal(fourth.json.status, "pending_approval");
  const after = (await call("/rest/v1/credit_balance?select=balance", { token: admin })).json[0].balance;
  assert.equal(after, before + 150);
});

await test("login limits: five failures lock the address for a while", async () => {
  for (let i = 0; i < 5; i++) await rpc("record_login", { p_email_hash: `e-${suffix}`, p_ip_hash: `i-${suffix}`, p_success: false }, { key: SERVICE });
  const allowed = await rpc("login_allowed", { p_email_hash: `e-${suffix}`, p_ip_hash: `other-${suffix}` }, { key: SERVICE });
  assert.equal(allowed.json, false);
  const other = await rpc("login_allowed", { p_email_hash: `x-${suffix}`, p_ip_hash: `other-${suffix}` }, { key: SERVICE });
  assert.equal(other.json, true);
});

for (const [status, name, message] of results) console.log(status.padEnd(4), name, message ? `— ${message}` : "");
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(failed ? `${failed} failed` : `all ${results.length} passed`);
process.exit(failed ? 1 : 0);
