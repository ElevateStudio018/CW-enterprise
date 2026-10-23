import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { config } from "./env.ts";
import { UserError } from "./http.ts";

/** Full access, for what the functions do on the site's behalf after checking who asks. */
export function serviceClient(): SupabaseClient {
  return createClient(config.supabaseUrl(), config.serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Acting as the signed-in person, so the database's own checks (row level security, is_admin) apply. */
export function userClient(request: Request): SupabaseClient {
  return createClient(config.supabaseUrl(), config.anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
}

/** The signed-in admin making the request; anyone else is turned away. */
export async function requireAdmin(request: Request): Promise<{ user: User; client: SupabaseClient }> {
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new UserError(401, "not_signed_in", "Du är inte inloggad.");
  const service = serviceClient();
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) throw new UserError(401, "not_signed_in", "Din inloggning har gått ut. Logga in igen.");
  const { data: profile } = await service.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") throw new UserError(403, "not_admin", "Kontot har inte behörighet till adminpanelen.");
  return { user: data.user, client: userClient(request) };
}

export async function audit(action: string, entity: string, before: unknown, after: unknown, actor: string | null, ip = ""): Promise<void> {
  await serviceClient().from("audit_log").insert({ action, entity, before, after, actor, ip });
}
