// supabase/functions/admin-login/index.ts
import { z } from "npm:zod@4.6.5";
import { createClient as createClient2 } from "npm:@supabase/supabase-js@2.117.2";

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

// supabase/functions/admin-login/index.ts
var credentials = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });
Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const parsed = credentials.safeParse(await readJson(request, 5e3));
    if (!parsed.success) throw new UserError(400, "invalid", "Ange e-postadress och l\xF6senord.");
    const { email, password } = parsed.data;
    const salt = config.secret("IP_HASH_SALT", "login");
    const emailHash = await sha256(email, salt);
    const ipHash = await sha256(clientIp(request), salt);
    const service = serviceClient();
    const { data: allowed, error: limitError } = await service.rpc("login_allowed", { p_email_hash: emailHash, p_ip_hash: ipHash });
    if (limitError) throw limitError;
    if (!allowed) {
      throw new UserError(429, "rate_limited", "F\xF6r m\xE5nga misslyckade f\xF6rs\xF6k. V\xE4nta en kvart och f\xF6rs\xF6k igen, eller \xE5terst\xE4ll l\xF6senordet.");
    }
    const auth = createClient2(config.supabaseUrl(), config.anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      await service.rpc("record_login", { p_email_hash: emailHash, p_ip_hash: ipHash, p_success: false });
      throw new UserError(401, "wrong_credentials", "Fel e-postadress eller l\xF6senord.");
    }
    const { data: profile } = await service.from("profiles").select("role, full_name").eq("id", data.user.id).maybeSingle();
    if (profile?.role !== "admin") {
      await service.rpc("record_login", { p_email_hash: emailHash, p_ip_hash: ipHash, p_success: false });
      await service.auth.admin.signOut(data.session.access_token).catch(() => {
      });
      throw new UserError(401, "wrong_credentials", "Fel e-postadress eller l\xF6senord.");
    }
    await service.rpc("record_login", { p_email_hash: emailHash, p_ip_hash: ipHash, p_success: true });
    await service.from("audit_log").insert({ action: "auth.login", entity: email, actor: data.user.id });
    const { access_token, refresh_token, expires_in, expires_at, token_type } = data.session;
    return json(request, { session: { access_token, refresh_token, expires_in, expires_at, token_type } });
  })
);
