// supabase/functions/submit-suggestion/index.ts
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
function clientIp(request) {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("cf-connecting-ip") || "ok\xE4nd";
}

// supabase/functions/_shared/supabase.ts
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
function serviceClient() {
  return createClient(config.supabaseUrl(), config.serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

// supabase/functions/_shared/crypto.ts
var encoder = new TextEncoder();
function hex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sha256(value, salt = "") {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(salt + value)));
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

// supabase/functions/submit-suggestion/index.ts
var requestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  area: z.string().trim().max(120).default(""),
  message: z.string().trim().min(3).max(3e3),
  /** Left empty by people; filled in by bots that fill in every field. */
  website: z.string().max(500).optional()
});
Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const parsed = requestSchema.safeParse(await readJson(request, 2e4));
    if (!parsed.success) throw new UserError(400, "invalid", "Skriv ditt namn och ditt f\xF6rslag.");
    const form = parsed.data;
    if (form.website) return json(request, { ok: true });
    const service = serviceClient();
    const senderHash = await sha256(clientIp(request), config.secret("IP_HASH_SALT", "suggestion"));
    const { data, error } = await service.rpc("insert_site_suggestion", {
      p_name: form.name,
      p_area: form.area,
      p_message: form.message,
      p_sender_hash: senderHash
    });
    if (error) throw error;
    if (data.status === "rate_limited") {
      throw new UserError(429, "rate_limited", "Du har skickat m\xE5nga f\xF6rslag p\xE5 kort tid. V\xE4nta en stund och f\xF6rs\xF6k igen.");
    }
    await sendMail({
      to: config.agencyEmail(),
      subject: `F\xF6rb\xE4ttringsf\xF6rslag fr\xE5n ${form.name}`,
      blocks: [
        block.heading("Nytt f\xF6rslag f\xF6r hemsidan"),
        block.rows([
          ["Fr\xE5n", form.name],
          ["G\xE4ller", form.area || "\u2013"],
          ["F\xF6rslag", form.message]
        ]),
        block.button("\xD6ppna i adminpanelen", `${config.adminUrl()}/hemsidan/?flik=forslag`)
      ]
    });
    return json(request, { ok: true });
  })
);
