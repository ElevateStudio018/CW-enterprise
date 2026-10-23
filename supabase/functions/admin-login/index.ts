// Signing in to the admin, with a limit of five failed attempts per address (and twenty per network) in fifteen
// minutes. Returns the session for the admin to keep.
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { clientIp, handle, json, readJson, UserError } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sha256 } from "../_shared/crypto.ts";
import { config } from "../_shared/env.ts";

const credentials = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const parsed = credentials.safeParse(await readJson(request, 5_000));
    if (!parsed.success) throw new UserError(400, "invalid", "Ange e-postadress och lösenord.");
    const { email, password } = parsed.data;

    const salt = config.secret("IP_HASH_SALT", "login");
    const emailHash = await sha256(email, salt);
    const ipHash = await sha256(clientIp(request), salt);
    const service = serviceClient();

    const { data: allowed, error: limitError } = await service.rpc("login_allowed", { p_email_hash: emailHash, p_ip_hash: ipHash });
    if (limitError) throw limitError;
    if (!allowed) {
      throw new UserError(429, "rate_limited", "För många misslyckade försök. Vänta en kvart och försök igen, eller återställ lösenordet.");
    }

    const auth = createClient(config.supabaseUrl(), config.anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      await service.rpc("record_login", { p_email_hash: emailHash, p_ip_hash: ipHash, p_success: false });
      throw new UserError(401, "wrong_credentials", "Fel e-postadress eller lösenord.");
    }

    const { data: profile } = await service.from("profiles").select("role, full_name").eq("id", data.user.id).maybeSingle();
    if (profile?.role !== "admin") {
      await service.rpc("record_login", { p_email_hash: emailHash, p_ip_hash: ipHash, p_success: false });
      await service.auth.admin.signOut(data.session.access_token).catch(() => {});
      throw new UserError(401, "wrong_credentials", "Fel e-postadress eller lösenord.");
    }

    await service.rpc("record_login", { p_email_hash: emailHash, p_ip_hash: ipHash, p_success: true });
    await service.from("audit_log").insert({ action: "auth.login", entity: email, actor: data.user.id });
    const { access_token, refresh_token, expires_in, expires_at, token_type } = data.session;
    return json(request, { session: { access_token, refresh_token, expires_in, expires_at, token_type } });
  })
);
