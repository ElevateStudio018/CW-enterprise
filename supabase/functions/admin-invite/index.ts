// Invites the admin addresses (private.admin_allowlist) that have no account yet: each gets a link to choose a
// password. Only for the service role, or with the one-time setup token whose hash is in settings.setup_token_hash.
import { handle, json, readJson, UserError } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { safeEqual, sha256 } from "../_shared/crypto.ts";
import { block, sendMail } from "../_shared/email.ts";
import { config } from "../_shared/env.ts";
import { createClient } from "@supabase/supabase-js";

/** Whether a key has full access (the service role or a secret key): only such a key may list the users. */
async function isServiceKey(key: string): Promise<boolean> {
  if (safeEqual(key, config.serviceRoleKey())) return true;
  const client = createClient(config.supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
  return !error;
}

Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const service = serviceClient();
    const bearer = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const body = await readJson<{ token?: string }>(request, 2_000).catch(() => ({}) as { token?: string });

    let allowed = bearer !== "" && (await isServiceKey(bearer));
    if (!allowed && body.token) {
      const { data } = await service.from("settings").select("value").eq("key", "setup_token_hash").maybeSingle();
      allowed = typeof data?.value === "string" && safeEqual(data.value, await sha256(body.token));
      // The token works once.
      if (allowed) await service.from("settings").delete().eq("key", "setup_token_hash");
    }
    if (!allowed) throw new UserError(403, "forbidden", "Ingen behörighet.");

    const { data: emails, error } = await service.rpc("admin_allowlist_without_account");
    if (error) throw error;
    const invited: string[] = [];
    for (const { email } of emails as { email: string }[]) {
      const { data, error: linkError } = await service.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: `${config.adminUrl()}/reset-password/?valkommen=1` },
      });
      if (linkError) {
        console.error("Could not invite", email, linkError);
        continue;
      }
      const sent = await sendMail({
        to: email,
        subject: "Välkommen till hemsidans adminpanel",
        blocks: [
          block.heading("Välkommen!"),
          block.text("Nu kan du själv ändra texter, bilder och färger på hemsidan – och se nya offertförfrågningar – i adminpanelen."),
          block.text("Börja med att välja ett lösenord:"),
          block.button("Välj lösenord", data.properties.action_link),
          block.small(`Adminpanelen hittar du sedan på ${config.adminUrl()}/. Länken i det här mejlet fungerar en gång.`),
        ],
      });
      if (sent) invited.push(email);
    }
    await service.from("audit_log").insert({ action: "auth.invite", entity: invited.join(", ") });
    return json(request, { invited });
  })
);
