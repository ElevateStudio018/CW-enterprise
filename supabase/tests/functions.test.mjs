// Edge Function checks against the local stack (supabase start, supabase functions serve, mock-services.mjs).
// Expects a freshly reset database: node supabase/tests/functions.test.mjs
import assert from "node:assert/strict";

const API = process.env.API_URL ?? "http://127.0.0.1:54321";
// The local stack's keys, from `supabase status -o env` (see supabase/tests/README.md).
const ANON = process.env.ANON_KEY;
const SERVICE = process.env.SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) throw new Error("Run with the local keys: eval \"$(supabase status -o env)\" first");
const MOCK = process.env.MOCK_URL ?? "http://127.0.0.1:54399";
const ORIGIN = "http://localhost:3130";
// During the preview Elevate Studio is both the admin (see the preview_admin migration) and the agency.
const ADMIN = "elevate.studio018@gmail.com";
const AGENCY = "elevate.studio018@gmail.com";

async function call(path, { method = "POST", token, key = ANON, body, headers = {} } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    redirect: "manual",
    headers: {
      apikey: key,
      Origin: ORIGIN,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, json, headers: response.headers };
}
const fn = (name, opts) => call(`/functions/v1/${name}`, opts);
const mocked = async () => (await (await fetch(`${MOCK}/__requests`)).json());
const clearMocks = () => fetch(`${MOCK}/__requests`, { method: "DELETE" });

const results = [];
async function test(name, body) {
  try { await body(); results.push(["ok", name]); } catch (error) { results.push(["FAIL", name, error.message]); }
}

await clearMocks();

await test("snapshot answers with the published version and honours its ETag", async () => {
  const first = await fn("snapshot", { method: "GET" });
  assert.equal(first.status, 200);
  assert.equal(first.json.version, 1);
  const etag = first.headers.get("etag");
  const again = await fn("snapshot", { method: "GET", headers: { "If-None-Match": etag } });
  assert.equal(again.status, 304);
});

await test("CORS: the site's origin may call, others get no allow header", async () => {
  // Locally Kong's own CORS plugin answers "*" in front of the functions; hosted, the function's answer goes through.
  const ok = await fetch(`${API}/functions/v1/submit-quote`, { method: "OPTIONS", headers: { Origin: ORIGIN } });
  assert.ok([ORIGIN, "*"].includes(ok.headers.get("access-control-allow-origin")));
  const other = await fetch(`${API}/functions/v1/submit-quote`, { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
  assert.ok([null, "*"].includes(other.headers.get("access-control-allow-origin")));
});

let inviteLink;
await test("admin-invite is closed without the service key, and invites the allowlisted address with it", async () => {
  const denied = await fn("admin-invite", { body: {} });
  assert.equal(denied.status, 403);
  const res = await fn("admin-invite", { body: {}, headers: { Authorization: `Bearer ${SERVICE}` } });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.deepEqual(res.json.invited, [ADMIN]);
  const mail = (await mocked()).find((r) => r.url === "/emails");
  assert.ok(mail, "an e-mail was sent");
  assert.deepEqual(mail.body.to, [ADMIN]);
  inviteLink = mail.body.html.match(/href="([^"]+verify[^"]+)"/)[1].replace(/&amp;/g, "&");
  assert.match(inviteLink, /type=invite/);
});

let adminToken;
await test("the invitation link signs the admin in, and they choose a password", async () => {
  const response = await fetch(inviteLink.replace("http://kong:8000", API), { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  assert.match(location, /reset-password/);
  const token = new URLSearchParams(location.split("#")[1]).get("access_token");
  assert.ok(token, location);
  const weak = await call("/auth/v1/user", { method: "PUT", token, body: { password: "kort" } });
  assert.notEqual(weak.status, 200);
  const set = await call("/auth/v1/user", { method: "PUT", token, body: { password: "Starkt-Lösen0rd!" } });
  assert.equal(set.status, 200, JSON.stringify(set.json));
});

await test("admin-login: wrong password is refused in Swedish, the right one gives a session", async () => {
  const wrong = await fn("admin-login", { body: { email: ADMIN, password: "fel" } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.message, "Fel e-postadress eller lösenord.");
  const right = await fn("admin-login", { body: { email: ADMIN.toUpperCase(), password: "Starkt-Lösen0rd!" } });
  assert.equal(right.status, 200, JSON.stringify(right.json));
  adminToken = right.json.session.access_token;
  assert.ok(adminToken);
});

await test("admin-login locks an address after five failures", async () => {
  for (let i = 0; i < 5; i++) await fn("admin-login", { body: { email: "nobody@example.com", password: "fel" } });
  const locked = await fn("admin-login", { body: { email: "nobody@example.com", password: "fel" } });
  assert.equal(locked.status, 429);
  assert.match(locked.json.message, /Vänta en kvart/);
});

await test("password reset mails a link to admins only, and answers the same for anyone", async () => {
  await clearMocks();
  const known = await fn("admin-password-reset", { body: { email: ADMIN } });
  const unknown = await fn("admin-password-reset", { body: { email: "nobody@example.com" } });
  assert.deepEqual([known.status, unknown.status], [200, 200]);
  const mails = (await mocked()).filter((r) => r.url === "/emails");
  assert.equal(mails.length, 1);
  assert.match(mails[0].body.html, /type=recovery/);
});

await test("publish: refuses with nothing to publish, publishes a change and starts the rebuild", async () => {
  await clearMocks();
  const nothing = await fn("publish", { token: adminToken, body: {} });
  assert.equal(nothing.status, 409);
  const save = await call("/rest/v1/rpc/save_content_patch", {
    token: adminToken,
    body: { p_path: ["pages", "items", "hem", "sections", "items", "hero", "heading"], p_value: "Testrubrik", p_client_id: "t" },
  });
  assert.equal(save.json.status, "saved");
  const res = await fn("publish", { token: adminToken, body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.version, 2);
  assert.match(res.json.summary, /Startsidan › Toppen › Rubrik/);
  assert.equal(res.json.deploy.started, true);
  const dispatch = (await mocked()).find((r) => r.url.endsWith("/dispatches"));
  assert.ok(dispatch);
  assert.equal(dispatch.body.ref, "claude/ny-webbplats");
});

await test("publish refuses content that breaks the schema, naming the field", async () => {
  await call("/rest/v1/rpc/save_content_patch", {
    token: adminToken,
    body: { p_path: ["company", "email"], p_value: "inte en adress", p_client_id: "t" },
  });
  const res = await fn("publish", { token: adminToken, body: {} });
  assert.equal(res.status, 422);
  assert.equal(res.json.issues[0].where, "Företagsuppgifter › E-post");
  await call("/rest/v1/rpc/discard_draft", { token: adminToken, body: {} });
});

await test("publish is closed to people who are not signed in", async () => {
  const res = await fn("publish", { body: {} });
  assert.equal(res.status, 401);
});

await test("submit-quote stores the request and e-mails it (to Elevate Studio until launch)", async () => {
  await clearMocks();
  const res = await fn("submit-quote", { body: { name: "Anna Andersson", phone: "070-123 45 67", email: "anna@example.com", workType: "Dränering", message: "Hej!" } });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const mail = (await mocked()).find((r) => r.url === "/emails");
  assert.deepEqual(mail.body.to, [AGENCY]);
  assert.equal(mail.body.subject, "Offertförfrågan från Anna Andersson");
  assert.equal(mail.body.reply_to, "anna@example.com");
  const rows = (await call("/rest/v1/quote_requests?select=name,work_type", { method: "GET", token: adminToken })).json;
  assert.equal(rows.some((r) => r.name === "Anna Andersson"), true);
});

await test("submit-quote: a bot filling the hidden field is thanked and ignored; no contact is refused", async () => {
  const bot = await fn("submit-quote", { body: { name: "Bot", phone: "1234567", email: "", workType: "", message: "", website: "spam" } });
  assert.equal(bot.status, 200);
  const rows = (await call("/rest/v1/quote_requests?select=name&name=eq.Bot", { method: "GET", token: adminToken })).json;
  assert.equal(rows.length, 0);
  const none = await fn("submit-quote", { body: { name: "X", phone: "", email: "", workType: "", message: "" } });
  assert.equal(none.status, 400);
});

await test("submit-suggestion stores the suggestion, e-mails Elevate Studio and limits one sender", async () => {
  await clearMocks();
  // Each test sender gets its own address, so the limit is counted for it alone.
  const sender = { "X-Forwarded-For": "10.20.30.40" };
  const res = await fn("submit-suggestion", { headers: sender, body: { name: "Erik Lund", area: "Offertformuläret", message: "Lägg till ett fält för adress." } });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const mail = (await mocked()).find((r) => r.url === "/emails");
  assert.deepEqual(mail.body.to, [AGENCY]);
  assert.equal(mail.body.subject, "Förbättringsförslag från Erik Lund");
  assert.match(mail.body.html, /\/hemsidan\/\?flik=forslag/);
  const rows = (await call("/rest/v1/site_suggestions?select=name,area,status", { method: "GET", token: adminToken })).json;
  assert.deepEqual(rows.find((r) => r.name === "Erik Lund"), { name: "Erik Lund", area: "Offertformuläret", status: "new" });
  for (let i = 0; i < 9; i++) {
    const more = await fn("submit-suggestion", { headers: sender, body: { name: "Erik Lund", message: `Förslag ${i}` } });
    assert.equal(more.status, 200, JSON.stringify(more.json));
  }
  const limited = await fn("submit-suggestion", { headers: sender, body: { name: "Erik Lund", message: "Ett till" } });
  assert.equal(limited.status, 429);
  assert.match(limited.json.message, /Vänta en stund/);
  const other = await fn("submit-suggestion", { headers: { "X-Forwarded-For": "10.20.30.41" }, body: { name: "Maria Holm", message: "Från någon annan" } });
  assert.equal(other.status, 200);
});

await test("submit-suggestion: a bot is thanked and ignored; an empty suggestion is refused", async () => {
  const bot = await fn("submit-suggestion", { body: { name: "Bot", message: "Köp nu", website: "spam" } });
  assert.equal(bot.status, 200);
  const rows = (await call("/rest/v1/site_suggestions?select=name&name=eq.Bot", { method: "GET", token: adminToken })).json;
  assert.equal(rows.length, 0);
  const empty = await fn("submit-suggestion", { body: { name: "", message: "" } });
  assert.equal(empty.status, 400);
});

await test("credits-topup adds a pack, mails customer and agency; the fourth order in a day waits", async () => {
  await clearMocks();
  const balance = async () => (await call("/rest/v1/credit_balance?select=balance", { method: "GET", token: adminToken })).json[0].balance;
  const before = await balance();
  const bad = await fn("credits-topup", { token: adminToken, body: { credits: 7 } });
  assert.equal(bad.status, 400);
  const res = await fn("credits-topup", { token: adminToken, body: { credits: 50 } });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.status, "completed");
  assert.equal(await balance(), before + 50);
  const mails = (await mocked()).filter((r) => r.url === "/emails");
  // The confirmation to the admin who ordered, and the order to the agency.
  assert.deepEqual(mails.map((m) => m.body.to[0]), [ADMIN, AGENCY]);
  assert.match(mails[0].body.html, /årsfakturan/);
  assert.doesNotMatch(mails[1].body.html, /årsfakturan/);
  await fn("credits-topup", { token: adminToken, body: { credits: 50 } });
  await fn("credits-topup", { token: adminToken, body: { credits: 50 } });
  const fourth = await fn("credits-topup", { token: adminToken, body: { credits: 500 } });
  assert.equal(fourth.json.status, "pending_approval");
  assert.equal(await balance(), before + 150);
});

let approveLink;
let denyLink;
await test("reset-request needs RENSA, changes nothing and mails signed links", async () => {
  await clearMocks();
  const versionBefore = (await call("/rest/v1/site_snapshot?select=version", { method: "GET" })).json[0].version;
  const unconfirmed = await fn("reset-request", { token: adminToken, body: { confirm: "rensa" } });
  assert.equal(unconfirmed.status, 400);
  const res = await fn("reset-request", { token: adminToken, body: { confirm: "RENSA", reason: "Vill börja om" } });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.status, "pending");
  const again = await fn("reset-request", { token: adminToken, body: { confirm: "RENSA" } });
  assert.equal(again.status, 409);
  const versionAfter = (await call("/rest/v1/site_snapshot?select=version", { method: "GET" })).json[0].version;
  assert.equal(versionAfter, versionBefore);
  const mails = (await mocked()).filter((r) => r.url === "/emails");
  // The agency's e-mail is the one with the signed links; the admin who asked gets a confirmation without them.
  const agency = mails.find((m) => m.body.to[0] === AGENCY && /reset-decision/.test(m.body.html));
  const links = [...agency.body.html.matchAll(/href="([^"]+reset-decision[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  approveLink = links.find((l) => l.includes("action=approve"));
  denyLink = links.find((l) => l.includes("action=deny"));
  assert.ok(approveLink && denyLink);
  assert.ok(mails.some((m) => m.body.to[0] === ADMIN && !/reset-decision/.test(m.body.html)));
});

await test("reset-decision refuses a tampered link", async () => {
  const tampered = approveLink.replace("action=approve", "action=deny");
  const res = await fetch(tampered);
  assert.equal(res.status, 400);
});

await test("approving resets to the original after a backup; the link then stops working", async () => {
  await clearMocks();
  const res = await fetch(approveLink);
  const html = await res.text();
  assert.equal(res.status, 200, html);
  assert.match(html, /Godkänt/);
  const site = (await call("/rest/v1/site_snapshot?select=data,version", { method: "GET" })).json[0];
  assert.equal(site.data.pages.items.hem.sections.items.hero.heading, "Mark- och grundarbeten i Kungälv & Göteborg");
  const history = (await call("/rest/v1/rpc/revision_list", { token: adminToken, body: {} })).json;
  assert.equal(history[0].source, "reset");
  assert.equal(history[1].source, "backup");
  assert.ok((await mocked()).some((r) => r.url.endsWith("/dispatches")));
  const reuse = await fetch(approveLink);
  assert.equal(reuse.status, 409);
  const deny = await fetch(denyLink);
  assert.equal(deny.status, 409);
});

await test("a pending request can be withdrawn by the customer", async () => {
  const res = await fn("reset-request", { token: adminToken, body: { confirm: "RENSA" } });
  assert.equal(res.json.status, "pending");
  const cancel = await fn("reset-request", { method: "DELETE", token: adminToken });
  assert.equal(cancel.json.status, "cancelled");
  const state = await fn("reset-request", { method: "GET", token: adminToken });
  assert.equal(state.json.pending, null);
});

// ---------------------------------------------------------------------------------------------------------------------
// The AI assistant, with scripted answers from the mock instead of the model.

const scriptAi = (answers) => fetch(`${MOCK}/__ai`, { method: "POST", body: JSON.stringify(answers) });
/** Calls a streaming action and returns its events. */
async function aiStream(body) {
  const response = await fetch(`${API}/functions/v1/ai-assistant`, {
    method: "POST",
    headers: { apikey: ANON, Origin: ORIGIN, Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.headers.get("content-type")?.includes("event-stream")) return { status: response.status, json: JSON.parse(text), events: [] };
  const events = text.split("\n\n").filter((chunk) => chunk.startsWith("data: ")).map((chunk) => JSON.parse(chunk.slice(6)));
  return { status: response.status, events, done: events.find((event) => event.type === "done") };
}
const credits = async () => (await call("/rest/v1/credit_balance?select=balance", { method: "GET", key: SERVICE, headers: { Authorization: `Bearer ${SERVICE}` } })).json[0].balance;
const published = async () => (await call("/rest/v1/site_snapshot?select=version,data&id=eq.1", { method: "GET" })).json[0];
const faqPath = ["pages", "items", "hem", "sections", "items", "faq", "items"];
const newQuestion = { question: "Hur djupt måste man gräva för dränering?", answer: "Oftast ned till husgrundens underkant, så att vattnet leds bort från grunden." };

let conversationId;
await test("ai: a question is answered at no cost, streaming the reply", async () => {
  await clearMocks();
  await scriptAi([{ text: JSON.stringify({ reply: "Dränering görs oftast när grunden har fuktproblem.", kind: "answer", summary: "", items: [] }) }]);
  const res = await aiStream({ action: "send", text: "När behöver man dränera?" });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  conversationId = res.events.find((event) => event.type === "start").conversationId;
  const streamed = res.events.filter((event) => event.type === "reply").map((event) => event.text).join("");
  assert.equal(streamed, "Dränering görs oftast när grunden har fuktproblem.");
  assert.equal(res.done.message.status, "done");
  assert.equal(res.done.message.credit_cost, 0);
  const sent = (await mocked()).find((r) => r.url.startsWith("/v1/messages"));
  assert.equal(sent.body.model, "claude-opus-5-5");
  assert.equal(sent.body.fallbacks, "default");
  assert.equal(sent.body.output_config.format.type, "json_schema");
  assert.match(sent.body.system[1].text, /Västkust Bygg & Montage AB/);
});

let proposal;
await test("ai: a change is planned and priced by the table before anything happens", async () => {
  await scriptAi([{ text: JSON.stringify({ reply: "Jag lägger till en fråga om dränering.", kind: "change", summary: "En ny fråga i Vanliga frågor.", items: [{ kind: "element", description: "Ny fråga om dränering" }] }) }]);
  const before = await published();
  const res = await aiStream({ action: "send", conversationId, text: "Lägg till en fråga om hur djupt man gräver vid dränering" });
  proposal = res.done.message;
  assert.equal(proposal.status, "estimated");
  assert.equal(proposal.credit_cost, 5);
  assert.equal(proposal.plan.total, 5);
  assert.equal((await published()).version, before.version);
});

await test("ai: approving makes the change set, retries once when it breaks the rules, then shows a preview", async () => {
  await clearMocks();
  const bad = { summary: "x", operations: [{ op: "insert", path: faqPath, id: "dranering-djup", place: "after", afterId: "finns-inte", itemJson: JSON.stringify(newQuestion) }], imagesNeeded: [] };
  const good = { summary: "Jag lade till frågan om dränering sist i Vanliga frågor.", operations: [{ op: "insert", path: faqPath, id: "dranering-djup", place: "last", afterId: "", itemJson: JSON.stringify(newQuestion) }], imagesNeeded: [] };
  await scriptAi([{ text: JSON.stringify(bad) }, { text: JSON.stringify(good) }]);
  const startCredits = await credits();
  const res = await aiStream({ action: "approve", messageId: proposal.id });
  assert.equal(res.done?.message?.status, "preview", JSON.stringify(res.events.slice(-2)));
  assert.equal(res.done.message.credit_cost, 5);
  assert.ok(res.done.message.change_set.patches.some((patch) => patch.path.join(".") === [...faqPath, "items", "dranering-djup"].join(".")));
  const calls = (await mocked()).filter((r) => r.url.startsWith("/v1/messages"));
  assert.equal(calls.length, 2);
  assert.match(JSON.stringify(calls[1].body.messages.at(-1)), /afterId/);
  assert.equal(await credits(), startCredits, "nothing is charged for a preview");
});

await test("ai: publishing charges the credits and publishes the change as a new version", async () => {
  const startCredits = await credits();
  const before = await published();
  const res = await fn("ai-assistant", { token: adminToken, body: { action: "publish", messageId: proposal.id } });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.version, before.version + 1);
  assert.equal(res.json.balance, startCredits - 5);
  const site = await published();
  assert.deepEqual(site.data.pages.items.hem.sections.items.faq.items.items["dranering-djup"], newQuestion);
  assert.equal(site.data.pages.items.hem.sections.items.faq.items.order.at(-1), "dranering-djup");
  assert.ok((await mocked()).some((r) => r.url.includes("/dispatches")), "the site is rebuilt");
});

await test("ai: undoing a published change restores the version before it and refunds the credits", async () => {
  const startCredits = await credits();
  const res = await fn("ai-assistant", { token: adminToken, body: { action: "rollback", messageId: proposal.id } });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.message.status, "rolled_back");
  assert.equal(res.json.balance, startCredits + 5);
  const site = await published();
  assert.equal(site.data.pages.items.hem.sections.items.faq.items.items["dranering-djup"], undefined);
});

await test("ai: a proposal can be dropped, and a refused or cut-off answer charges nothing", async () => {
  await scriptAi([{ text: JSON.stringify({ reply: "Jag gör knapparna mörkare.", kind: "change", summary: "Mörkare knappar.", items: [{ kind: "theme", description: "Mörkare knappfärg" }] }) }]);
  const res = await aiStream({ action: "send", conversationId, text: "Gör knapparna mörkare" });
  assert.equal(res.done.message.credit_cost, 2);
  const dropped = await fn("ai-assistant", { token: adminToken, body: { action: "discard", messageId: res.done.message.id } });
  assert.equal(dropped.json.message.status, "discarded");
  await scriptAi([{ text: "", stop_reason: "refusal" }]);
  const refused = await aiStream({ action: "send", conversationId, text: "Något konstigt" });
  assert.equal(refused.done.message.status, "failed");
  assert.equal(refused.done.message.credit_cost, 0);
});

await test("ai: only admins may use it", async () => {
  const res = await fn("ai-assistant", { body: { action: "send", text: "Hej" } });
  assert.equal(res.status, 401);
});

for (const [status, name, message] of results) console.log(status.padEnd(4), name, message ? `— ${message}` : "");
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(failed ? `${failed} failed` : `all ${results.length} passed`);
process.exit(failed ? 1 : 0);
