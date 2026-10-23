// "Glömt lösenordet?": e-mails a one-time link to choose a new password. Answers the same whether or not the address
// belongs to an admin, so it cannot be used to find out who does.
import { z } from "zod";
import { clientIp, handle, json, readJson, UserError } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sha256 } from "../_shared/crypto.ts";
import { block, sendMail } from "../_shared/email.ts";
import { config } from "../_shared/env.ts";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const parsed = schema.safeParse(await readJson(request, 2_000));
    if (!parsed.success) throw new UserError(400, "invalid", "Ange en giltig e-postadress.");
    const { email } = parsed.data;
    const service = serviceClient();

    // At most three links per address and hour.
    const emailHash = await sha256(email, config.secret("IP_HASH_SALT", "reset"));
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await service.from("audit_log").select("id", { count: "exact", head: true })
      .eq("action", "auth.reset_link").eq("entity", emailHash).gte("created_at", since);
    if ((count ?? 0) >= 3) return json(request, { ok: true });

    const { data: profile } = await service.from("profiles").select("id, role").eq("email", email).maybeSingle();
    if (profile?.role === "admin") {
      const { data, error } = await service.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${config.adminUrl()}/reset-password/` },
      });
      if (error) throw error;
      await sendMail({
        to: email,
        subject: "Välj ett nytt lösenord till adminpanelen",
        blocks: [
          block.heading("Nytt lösenord"),
          block.text("Någon (förhoppningsvis du) bad om att få välja ett nytt lösenord till hemsidans adminpanel."),
          block.button("Välj nytt lösenord", data.properties.action_link),
          block.small("Länken fungerar en gång och går ut inom en timme. Bad du inte om det här kan du strunta i mejlet – ditt lösenord är oförändrat."),
        ],
      });
      await service.from("audit_log").insert({ action: "auth.reset_link", entity: emailHash, actor: profile.id, ip: await sha256(clientIp(request), "ip") });
    }
    return json(request, { ok: true });
  })
);
