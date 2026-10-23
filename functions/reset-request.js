// supabase/functions/reset-request/index.ts
import { z } from "npm:zod@4.6.5";

// supabase/functions/_shared/env.ts
function env(name, fallback) {
  const value = Deno.env.get(name) ?? fallback;
  if (value === void 0 || value === "") throw new Error(`Missing setting ${name}`);
  return value;
}
function optionalEnv(name) {
  const value = Deno.env.get(name);
  return value === void 0 || value === "" ? void 0 : value;
}
var config = {
  supabaseUrl: () => env("SUPABASE_URL"),
  anonKey: () => env("SUPABASE_ANON_KEY"),
  serviceRoleKey: () => env("SUPABASE_SERVICE_ROLE_KEY"),
  /** The public site, for links in e-mails. */
  siteUrl: () => env("SITE_URL", "https://elevatestudio018.github.io/CW-enterprise"),
  /** The admin panel, for links in e-mails. */
  adminUrl: () => env("ADMIN_URL", `${env("SITE_URL", "https://elevatestudio018.github.io/CW-enterprise")}/admin`),
  /** Elevate Studio, who approve resets, receive credit orders and the staff's suggestions, and quote requests until launch. */
  agencyEmail: () => env("AGENCY_EMAIL", "elevate.studio018@gmail.com"),
  /** A secret for one purpose: its own setting when there is one, otherwise derived from the service role key, so a new
   * project needs no extra random strings made up for it. */
  secret: (name, purpose) => optionalEnv(name) ?? `${purpose}:${env("SUPABASE_SERVICE_ROLE_KEY")}`,
  /** Browsers allowed to call the functions (the site and admin's origins), comma-separated. */
  allowedOrigins: () => env("ALLOWED_ORIGINS", "https://elevatestudio018.github.io,http://localhost:3000,http://localhost:3130,http://localhost:3132,http://127.0.0.1:3000").split(",").map((origin) => origin.trim())
};

// supabase/functions/_shared/http.ts
function corsHeaders(request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = config.allowedOrigins().includes(origin);
  return {
    ...allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {},
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-id",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400"
  };
}
function json(request, body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request), ...extra }
  });
}
var UserError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
function handle(handler) {
  return async (request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof UserError) return json(request, { error: error.code, message: error.message }, error.status);
      console.error(error);
      return json(request, { error: "server_error", message: "N\xE5got gick fel hos oss. F\xF6rs\xF6k igen om en stund." }, 500);
    }
  };
}
async function readJson(request, maxBytes = 2e6) {
  const text = await request.text();
  if (text.length > maxBytes) throw new UserError(413, "too_large", "Det du skickade var f\xF6r stort.");
  try {
    return JSON.parse(text);
  } catch {
    throw new UserError(400, "bad_request", "Ogiltig f\xF6rfr\xE5gan.");
  }
}

// supabase/functions/_shared/supabase.ts
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
function serviceClient() {
  return createClient(config.supabaseUrl(), config.serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
function userClient(request) {
  return createClient(config.supabaseUrl(), config.anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } }
  });
}
async function requireAdmin(request) {
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new UserError(401, "not_signed_in", "Du \xE4r inte inloggad.");
  const service = serviceClient();
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) throw new UserError(401, "not_signed_in", "Din inloggning har g\xE5tt ut. Logga in igen.");
  const { data: profile } = await service.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") throw new UserError(403, "not_admin", "Kontot har inte beh\xF6righet till adminpanelen.");
  return { user: data.user, client: userClient(request) };
}
async function audit(action, entity, before, after, actor, ip = "") {
  await serviceClient().from("audit_log").insert({ action, entity, before, after, actor, ip });
}

// supabase/functions/_shared/crypto.ts
var encoder = new TextEncoder();
function hex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sha256(value, salt = "") {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(salt + value)));
}
async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}
function randomToken(bytes = 32) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

// supabase/functions/_shared/email.ts
var escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
var INK = "#1C1F22";
var TEXT = "#4A5157";
var MUTED = "#5A6065";
var LINE = "#DCDFDA";
var HEADING_FONT = "'Josefin Sans',Helvetica,Arial,sans-serif";
var BODY_FONT = "'Nunito Sans',Helvetica,Arial,sans-serif";
var block = {
  heading: (text) => `<h1 style="margin:0 0 18px;font-family:${HEADING_FONT};font-size:28px;line-height:1.15;font-weight:400;color:${INK}">${escapeHtml(text)}</h1>`,
  text: (text) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${TEXT}">${escapeHtml(text)}</p>`,
  rows: (rows) => `<table role="presentation" style="width:100%;border-collapse:collapse;margin:4px 0 22px;border-top:2px solid ${INK}">${rows.map(
    ([label, value]) => `<tr><td style="padding:11px 14px 11px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${MUTED};white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:11px 0;border-bottom:1px solid ${LINE};font-size:15px;line-height:1.5;color:${INK}">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`
  ).join("")}</table>`,
  button: (label, href, tone = "primary") => `<p style="margin:8px 0 18px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 30px;border-radius:999px;background:${tone === "danger" ? "#8B1D1D" : INK};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">${escapeHtml(label)}&nbsp;&nbsp;&rarr;</a></p>`,
  small: (text) => `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">${escapeHtml(text)}</p>`
};
function html(mail) {
  const site = config.siteUrl().replace(/\/$/, "");
  const stripe = (color) => `<td style="height:4px;line-height:4px;font-size:0;background:${color}">&nbsp;</td>`;
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600&family=Nunito+Sans:wght@400;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:#EFF1ED;font-family:${BODY_FONT};color:${TEXT}">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:28px 12px">
<table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${LINE}">
<tr><td style="padding:0"><a href="${site}/"><img src="${site}/photos/mejl-fjall.jpg" width="600" alt="Fj\xE4llvidd" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
<tr><td style="padding:0"><table role="presentation" style="width:100%;border-collapse:collapse"><tr>${stripe("#34506E")}${stripe("#E2601A")}${stripe("#1F86EC")}</tr></table></td></tr>
<tr><td style="padding:26px 32px 4px">
<p style="margin:0;font-family:${HEADING_FONT};font-size:24px;letter-spacing:0.01em;color:${INK}">CW Enterprise AB</p>
<p style="margin:4px 0 0;font-size:13px;color:${MUTED}">Leder, utvecklar och f\xF6rvaltar dina projekt</p>
</td></tr>
<tr><td style="padding:22px 32px 30px">${mail.blocks.join("")}</td></tr>
<tr><td style="padding:20px 32px;background:#FBFBF9;border-top:1px solid ${LINE};font-size:12.5px;line-height:1.6;color:${MUTED}">
CW Enterprise AB \xB7 Kullaviks Kvarnfallsv\xE4g 11, 429 33 Kullavik<br>
+46 709 188 160 \xB7 <a href="mailto:info@cwenterprise.se" style="color:${MUTED}">info@cwenterprise.se</a> \xB7 <a href="${site}/" style="color:${MUTED}">Hemsidan</a>
</td></tr>
</table></td></tr></table></body></html>`;
}
function plain(mail) {
  return mail.blocks.map(
    (b) => b.replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, "$2: $1").replace(/<\/(p|h1|tr)>/g, "\n").replace(/<\/td><td[^>]*>/g, ": ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  ).join("\n").trim();
}
async function sendMail(mail) {
  const apiKey = optionalEnv("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set; e-mail not sent:", mail.subject);
    return false;
  }
  try {
    const response = await fetch(`${env("RESEND_API_URL", "https://api.resend.com")}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("EMAIL_FROM", "CW Enterprise <onboarding@resend.dev>"),
        to: Array.isArray(mail.to) ? mail.to : [mail.to],
        subject: mail.subject,
        html: html(mail),
        text: plain(mail),
        ...mail.replyTo ? { reply_to: mail.replyTo } : {}
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      const owner = detail.match(/own email address \(([^)\s]+@[^)\s]+)\)/)?.[1];
      const intended = (Array.isArray(mail.to) ? mail.to : [mail.to]).join(", ");
      if (response.status === 403 && owner && !intended.includes(owner)) {
        console.warn(`Resend: the sending domain is not verified; delivering to ${owner} instead of ${intended}`);
        return sendMail({
          ...mail,
          to: owner,
          subject: `[Till ${intended}] ${mail.subject}`,
          blocks: [block.small(`Det h\xE4r mejlet skulle ha g\xE5tt till ${intended}. Det kom hit eftersom avs\xE4ndardom\xE4nen \xE4nnu inte \xE4r verifierad i Resend.`), ...mail.blocks]
        });
      }
      console.error("Resend refused the e-mail:", response.status, detail);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Could not reach Resend:", error);
    return false;
  }
}

// supabase/functions/_shared/reset.ts
var signingSecret = () => config.secret("RESET_SIGNING_SECRET", "reset-links");
var functionsUrl = () => env("FUNCTIONS_PUBLIC_URL", `${env("SUPABASE_URL")}/functions/v1`);
async function decisionLink(id, action, expires, token) {
  const sig = await hmac(signingSecret(), `${id}.${action}.${expires}.${token}`);
  const query = new URLSearchParams({ id, action, exp: String(expires), token, sig });
  return `${functionsUrl()}/reset-decision?${query}`;
}
async function expireOverdueRequests() {
  const service = serviceClient();
  const { data: overdue } = await service.from("reset_requests").update({ status: "expired", decided_at: (/* @__PURE__ */ new Date()).toISOString(), decided_by: "expired" }).eq("status", "pending").lt("expires_at", (/* @__PURE__ */ new Date()).toISOString()).select("id, requested_by");
  for (const request of overdue ?? []) {
    const { data: profile } = await service.from("profiles").select("email").eq("id", request.requested_by).maybeSingle();
    if (profile?.email) {
      await sendMail({
        to: profile.email,
        subject: "Din beg\xE4ran om att rensa \xE4ndringar godk\xE4ndes inte",
        blocks: [
          block.heading("Beg\xE4ran gick ut"),
          block.text("Elevate Studio hann inte godk\xE4nna din beg\xE4ran om att rensa alla \xE4ndringar inom 72 timmar, s\xE5 ingenting har \xE4ndrats p\xE5 hemsidan."),
          block.text("Vill du fortfarande rensa \xE4ndringarna kan du g\xF6ra en ny beg\xE4ran i adminpanelen, eller h\xF6ra av dig till Elevate Studio."),
          block.button("Till adminpanelen", `${config.adminUrl()}/installningar/?flik=farozon`)
        ]
      });
    }
    await service.from("audit_log").insert({ action: "reset.expired", entity: request.id, actor: request.requested_by });
  }
}

// supabase/functions/reset-request/index.ts
var schema = z.object({ confirm: z.literal("RENSA"), reason: z.string().trim().max(1e3).optional() });
var HOURS_VALID = 72;
Deno.serve(
  handle(async (request) => {
    const { user } = await requireAdmin(request);
    const service = serviceClient();
    await expireOverdueRequests();
    const pending = async () => (await service.from("reset_requests").select("id, status, reason, created_at, expires_at").eq("status", "pending").maybeSingle()).data;
    if (request.method === "GET") return json(request, { pending: await pending() });
    if (request.method === "DELETE") {
      const current = await pending();
      if (!current) throw new UserError(404, "none", "Det finns ingen beg\xE4ran att \xE5terkalla.");
      await service.from("reset_requests").update({ status: "cancelled", decided_at: (/* @__PURE__ */ new Date()).toISOString(), decided_by: user.email }).eq("id", current.id);
      await audit("reset.cancelled", current.id, null, null, user.id);
      await sendMail({
        to: config.agencyEmail(),
        subject: "Beg\xE4ran om att rensa \xE4ndringar har \xE5terkallats",
        blocks: [block.heading("Beg\xE4ran \xE5terkallad"), block.text(`${user.email} har sj\xE4lv \xE5terkallat sin beg\xE4ran. L\xE4nkarna i det tidigare mejlet fungerar inte l\xE4ngre.`)]
      });
      return json(request, { status: "cancelled" });
    }
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const parsed = schema.safeParse(await readJson(request, 5e3));
    if (!parsed.success) throw new UserError(400, "confirm", "Skriv RENSA f\xF6r att bekr\xE4fta.");
    if (await pending()) throw new UserError(409, "already_pending", "Det finns redan en beg\xE4ran som v\xE4ntar p\xE5 godk\xE4nnande.");
    const { data: snapshot, error: snapshotError } = await service.from("site_snapshot").select("version, data").eq("id", 1).single();
    if (snapshotError || !snapshot) throw snapshotError ?? new Error("No published snapshot");
    const token = randomToken();
    const expires = Date.now() + HOURS_VALID * 60 * 60 * 1e3;
    const { data: created, error } = await service.from("reset_requests").insert({
      requested_by: user.id,
      reason: parsed.data.reason ?? "",
      snapshot_version: snapshot.version,
      token_hash: await sha256(token),
      expires_at: new Date(expires).toISOString()
    }).select("id, created_at, expires_at").single();
    if (error) throw error;
    await audit("reset.requested", created.id, null, { reason: parsed.data.reason ?? "", version: snapshot.version }, user.id);
    const company = snapshot.data?.company?.legalName ?? "";
    const when = (/* @__PURE__ */ new Date()).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });
    await sendMail({
      to: config.agencyEmail(),
      subject: `Godk\xE4nn rensning av hemsidan \u2013 ${company || "kund"}`,
      blocks: [
        block.heading("Beg\xE4ran om att rensa alla \xE4ndringar"),
        block.text("Kunden vill \xE5terst\xE4lla hemsidan till den ursprungliga versionen. Alla \xE4ndringar av texter, f\xE4rger, typsnitt och sektioner tas bort. Offertf\xF6rfr\xE5gningar, bilder, credits och historik p\xE5verkas inte, och en s\xE4kerhetskopia tas f\xF6rst."),
        block.rows([
          ["F\xF6retag", company || "\u2013"],
          ["Beg\xE4rd av", user.email ?? "\u2013"],
          ["Tid", when],
          ["Nuvarande version", String(snapshot.version)],
          ["Anledning", parsed.data.reason || "\u2013"]
        ]),
        block.button("Godk\xE4nn", await decisionLink(created.id, "approve", expires, token)),
        block.button("Neka", await decisionLink(created.id, "deny", expires, token), "danger"),
        block.small(`L\xE4nkarna fungerar en g\xE5ng och g\xE5r ut om ${HOURS_VALID} timmar. G\xF6rs inget s\xE5 h\xE4nder ingenting.`)
      ]
    });
    if (user.email) {
      await sendMail({
        to: user.email,
        subject: "Din beg\xE4ran om att rensa \xE4ndringar \xE4r registrerad",
        blocks: [
          block.heading("Beg\xE4ran mottagen"),
          block.text("Din beg\xE4ran om att rensa alla \xE4ndringar v\xE4ntar nu p\xE5 godk\xE4nnande fr\xE5n Elevate Studio. Ingenting har \xE4ndrats p\xE5 hemsidan \xE4n."),
          block.text("Du f\xE5r ett mejl n\xE4r beg\xE4ran har behandlats. \xC5ngrar du dig kan du \xE5terkalla den i adminpanelen."),
          block.button("Till adminpanelen", `${config.adminUrl()}/installningar/?flik=farozon`)
        ]
      });
    }
    return json(request, { status: "pending", pending: { id: created.id, created_at: created.created_at, expires_at: created.expires_at } });
  })
);
