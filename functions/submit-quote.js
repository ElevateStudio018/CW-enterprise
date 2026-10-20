// supabase/functions/submit-quote/index.ts
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
var block = {
  heading: (text) => `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#222222">${escapeHtml(text)}</h1>`,
  text: (text) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#333333">${escapeHtml(text)}</p>`,
  rows: (rows) => `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 18px">${rows.map(
    ([label, value]) => `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #e3e1d8;font-size:14px;color:#63625C;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #e3e1d8;font-size:15px;color:#222222">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`
  ).join("")}</table>`,
  button: (label, href, tone = "primary") => `<p style="margin:8px 0 18px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${tone === "danger" ? "#8B1D1D" : "#1C2817"};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:0.03em">${escapeHtml(label)}</a></p>`,
  small: (text) => `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#63625C">${escapeHtml(text)}</p>`
};
function html(mail) {
  return `<!doctype html><html lang="sv"><body style="margin:0;background:#E3E1D8;font-family:Figtree,Arial,sans-serif">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px">
<table role="presentation" style="max-width:560px;margin:0 auto;border-collapse:collapse;background:#F2F0E9">
<tr><td style="background:#121418;padding:18px 28px;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">CW Enterprise \xB7 Adminpanel</td></tr>
<tr><td style="padding:28px">${mail.blocks.join("")}</td></tr>
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
      console.error("Resend refused the e-mail:", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Could not reach Resend:", error);
    return false;
  }
}

// supabase/functions/_shared/site/format.ts
function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => key in values ? String(values[key]) : match);
}

// supabase/functions/submit-quote/index.ts
var requestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).regex(/^[\d\s()+-]*$/),
  email: z.union([z.literal(""), z.string().trim().max(200).email()]),
  workType: z.string().trim().max(200),
  message: z.string().trim().max(5e3),
  /** Left empty by people; filled in by bots that fill in every field. */
  website: z.string().max(500).optional()
});
Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const parsed = requestSchema.safeParse(await readJson(request, 2e4));
    if (!parsed.success) throw new UserError(400, "invalid", "Kontrollera f\xE4lten och f\xF6rs\xF6k igen.");
    const form = parsed.data;
    if (!form.phone && !form.email) throw new UserError(400, "invalid", "Ange telefonnummer eller e-postadress.");
    if (form.website) return json(request, { ok: true });
    const service = serviceClient();
    const senderHash = await sha256(clientIp(request), config.secret("IP_HASH_SALT", "quote"));
    const { data, error } = await service.rpc("insert_quote_request", {
      p_name: form.name,
      p_phone: form.phone,
      p_email: form.email,
      p_work_type: form.workType,
      p_message: form.message,
      p_sender_hash: senderHash
    });
    if (error) throw error;
    if (data.status === "rate_limited") {
      throw new UserError(429, "rate_limited", "Du har skickat flera f\xF6rfr\xE5gningar p\xE5 kort tid. Ring oss g\xE4rna ist\xE4llet.");
    }
    const { data: snapshot } = await service.from("site_snapshot").select("data").eq("id", 1).single();
    const site = snapshot?.data;
    const to = optionalEnv("QUOTE_NOTIFY_EMAIL") ?? config.agencyEmail();
    if (to) {
      await sendMail({
        to,
        replyTo: form.email || void 0,
        subject: fill(site?.form?.emailSubject ?? "Offertf\xF6rfr\xE5gan fr\xE5n {namn}", { namn: form.name }),
        blocks: [
          block.heading("Ny offertf\xF6rfr\xE5gan"),
          block.rows([
            ["Namn", form.name],
            ["Telefon", form.phone || "\u2013"],
            ["E-post", form.email || "\u2013"],
            ["Typ av arbete", form.workType || "\u2013"],
            ["Beskrivning", form.message || "\u2013"]
          ]),
          block.button("\xD6ppna i adminpanelen", `${config.adminUrl()}/offertforfragningar/`)
        ]
      });
    }
    return json(request, { ok: true });
  })
);
