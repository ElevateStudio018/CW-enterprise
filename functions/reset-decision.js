// supabase/functions/_shared/supabase.ts
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

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

// supabase/functions/_shared/supabase.ts
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
async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
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

// supabase/functions/_shared/deploy.ts
async function triggerDeploy(version) {
  const token = optionalEnv("GITHUB_DISPATCH_TOKEN");
  const service = serviceClient();
  const record = (value) => service.from("settings").upsert({ key: "deploy", value: { ...value, version, at: (/* @__PURE__ */ new Date()).toISOString() }, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  if (!token) {
    await record({ status: "not_configured" });
    return { started: false, message: "Uppdateringen av hemsidan \xE4r inte kopplad \xE4n (GITHUB_DISPATCH_TOKEN saknas)." };
  }
  const repository = env("GITHUB_REPOSITORY", "ElevateStudio018/CW-enterprise");
  const workflow = env("GITHUB_WORKFLOW", "deploy-pages.yml");
  const ref = env("GITHUB_REF", "claude/ny-webbplats");
  const api = env("GITHUB_API_URL", "https://api.github.com");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${api}/repos/${repository}/actions/workflows/${workflow}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "cw-enterprise-admin"
        },
        body: JSON.stringify({ ref })
      });
      if (response.status === 204) {
        await record({ status: "started" });
        return { started: true };
      }
      console.error("GitHub refused the deploy:", response.status, await response.text());
      if (response.status < 500) break;
    } catch (error) {
      console.error("Could not reach GitHub:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1e3));
  }
  await record({ status: "failed" });
  return { started: false, message: "\xC4ndringen \xE4r sparad, men hemsidan kunde inte uppdateras just nu. F\xF6rs\xF6k igen om en stund." };
}

// supabase/functions/_shared/reset.ts
var signingSecret = () => config.secret("RESET_SIGNING_SECRET", "reset-links");
async function linkIsSigned(id, action, expires, token, sig) {
  return safeEqual(sig, await hmac(signingSecret(), `${id}.${action}.${expires}.${token}`));
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

// supabase/functions/reset-decision/index.ts
function page(title, text, status = 200) {
  const escape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#E3E1D8;font-family:system-ui,sans-serif;color:#222">
<main style="max-width:480px;margin:24px;padding:32px;background:#F2F0E9"><h1 style="margin:0 0 12px;font-size:24px">${escape(title)}</h1>
<p style="margin:0;font-size:16px;line-height:1.5;color:#333">${escape(text)}</p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);
    const [id, action, exp, token, sig] = ["id", "action", "exp", "token", "sig"].map((key) => url.searchParams.get(key) ?? "");
    if (!id || !["approve", "deny"].includes(action) || !await linkIsSigned(id, action, exp, token, sig)) {
      return page("L\xE4nken \xE4r inte giltig", "L\xE4nken \xE4r felaktig eller ofullst\xE4ndig.", 400);
    }
    await expireOverdueRequests();
    if (Number(exp) < Date.now()) return page("L\xE4nken har g\xE5tt ut", "Beg\xE4ran gick ut efter 72 timmar och ingenting har \xE4ndrats.", 410);
    const service = serviceClient();
    const { data: request_ } = await service.from("reset_requests").select("*").eq("id", id).maybeSingle();
    if (!request_ || !safeEqual(request_.token_hash, await sha256(token))) return page("L\xE4nken \xE4r inte giltig", "Det finns ingen s\xE5dan beg\xE4ran.", 404);
    if (request_.status !== "pending") {
      const states = {
        approved: "Beg\xE4ran \xE4r redan godk\xE4nd och hemsidan \xE4r \xE5terst\xE4lld.",
        denied: "Beg\xE4ran \xE4r redan nekad.",
        cancelled: "Kunden har sj\xE4lv \xE5terkallat beg\xE4ran.",
        expired: "Beg\xE4ran har g\xE5tt ut."
      };
      return page("Redan behandlad", states[request_.status] ?? "Beg\xE4ran \xE4r redan behandlad.", 409);
    }
    const { data: requester } = await service.from("profiles").select("email").eq("id", request_.requested_by).maybeSingle();
    const recipients = [config.agencyEmail(), ...requester?.email ? [requester.email] : []];
    if (action === "deny") {
      await service.from("reset_requests").update({ status: "denied", decided_at: (/* @__PURE__ */ new Date()).toISOString(), decided_by: config.agencyEmail() }).eq("id", id).eq("status", "pending");
      await service.from("audit_log").insert({ action: "reset.denied", entity: id, actor_label: config.agencyEmail() });
      if (requester?.email) {
        await sendMail({
          to: requester.email,
          subject: "Din beg\xE4ran om att rensa \xE4ndringar godk\xE4ndes inte",
          blocks: [
            block.heading("Beg\xE4ran nekades"),
            block.text("Elevate Studio har inte godk\xE4nt beg\xE4ran om att rensa alla \xE4ndringar, s\xE5 ingenting har \xE4ndrats p\xE5 hemsidan. H\xF6r g\xE4rna av dig till dem om du har fr\xE5gor.")
          ]
        });
      }
      return page("Beg\xE4ran nekad", "Ingenting har \xE4ndrats. Kunden har f\xE5tt ett mejl om beslutet.");
    }
    const { data: result, error } = await service.rpc("reset_to_baseline", { p_request_id: id, p_decided_by: config.agencyEmail() });
    if (error) throw error;
    if (result.status !== "published") return page("Redan behandlad", "Beg\xE4ran kunde inte genomf\xF6ras eftersom den inte l\xE4ngre v\xE4ntar.", 409);
    const deploy = await triggerDeploy(result.version);
    await sendMail({
      to: recipients,
      subject: "Hemsidan \xE4r \xE5terst\xE4lld till ursprungsversionen",
      blocks: [
        block.heading("\xC4ndringarna \xE4r rensade"),
        block.text("Hemsidan \xE4r \xE5terst\xE4lld till sin ursprungliga version. En s\xE4kerhetskopia av versionen innan finns i versionshistoriken, s\xE5 det g\xE5r att \xE5ngra."),
        block.text(deploy.started ? "Den publicerade hemsidan uppdateras inom ett par minuter." : deploy.message ?? ""),
        block.button("Till adminpanelen", `${config.adminUrl()}/`)
      ]
    });
    return page("Godk\xE4nt", "Hemsidan \xE4r \xE5terst\xE4lld och uppdateras inom ett par minuter. En s\xE4kerhetskopia finns i versionshistoriken.");
  } catch (error) {
    console.error(error);
    return page("N\xE5got gick fel", "Beg\xE4ran kunde inte behandlas just nu. F\xF6rs\xF6k igen om en stund.", 500);
  }
});
