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

// supabase/functions/_shared/crypto.ts
var encoder = new TextEncoder();
function hex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sha256(value, salt = "") {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(salt + value)));
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
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

// supabase/functions/admin-invite/index.ts
import { createClient as createClient2 } from "npm:@supabase/supabase-js@2.117.2";
async function isServiceKey(key) {
  if (safeEqual(key, config.serviceRoleKey())) return true;
  const client = createClient2(config.supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
  return !error;
}
Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const service = serviceClient();
    const bearer = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const body = await readJson(request, 2e3).catch(() => ({}));
    let allowed = bearer !== "" && await isServiceKey(bearer);
    if (!allowed && body.token) {
      const { data } = await service.from("settings").select("value").eq("key", "setup_token_hash").maybeSingle();
      allowed = typeof data?.value === "string" && safeEqual(data.value, await sha256(body.token));
      if (allowed) await service.from("settings").delete().eq("key", "setup_token_hash");
    }
    if (!allowed) throw new UserError(403, "forbidden", "Ingen beh\xF6righet.");
    const { data: emails, error } = await service.rpc("admin_allowlist_without_account");
    if (error) throw error;
    const invited = [];
    for (const { email } of emails) {
      const { data, error: linkError } = await service.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: `${config.adminUrl()}/reset-password/?valkommen=1` }
      });
      if (linkError) {
        console.error("Could not invite", email, linkError);
        continue;
      }
      const sent = await sendMail({
        to: email,
        subject: "V\xE4lkommen till hemsidans adminpanel",
        blocks: [
          block.heading("V\xE4lkommen!"),
          block.text("Nu kan du sj\xE4lv \xE4ndra texter, bilder och f\xE4rger p\xE5 hemsidan \u2013 och se nya offertf\xF6rfr\xE5gningar \u2013 i adminpanelen."),
          block.text("B\xF6rja med att v\xE4lja ett l\xF6senord:"),
          block.button("V\xE4lj l\xF6senord", data.properties.action_link),
          block.small(`Adminpanelen hittar du sedan p\xE5 ${config.adminUrl()}/. L\xE4nken i det h\xE4r mejlet fungerar en g\xE5ng.`)
        ]
      });
      if (sent) invited.push(email);
    }
    await service.from("audit_log").insert({ action: "auth.invite", entity: invited.join(", ") });
    return json(request, { invited });
  })
);
