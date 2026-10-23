// The employees' suggestion box (/forslag): checks what was sent, stores it for the admin (Hemsidan → Förslag) and
// e-mails Elevate Studio.
import { z } from "zod";
import { clientIp, handle, json, readJson, UserError } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sha256 } from "../_shared/crypto.ts";
import { block, sendMail } from "../_shared/email.ts";
import { config } from "../_shared/env.ts";

const requestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  area: z.string().trim().max(120).default(""),
  message: z.string().trim().min(3).max(3000),
  /** Left empty by people; filled in by bots that fill in every field. */
  website: z.string().max(500).optional(),
});

Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const parsed = requestSchema.safeParse(await readJson(request, 20_000));
    if (!parsed.success) throw new UserError(400, "invalid", "Skriv ditt namn och ditt förslag.");
    const form = parsed.data;
    // A bot: thank it and do nothing.
    if (form.website) return json(request, { ok: true });

    const service = serviceClient();
    const senderHash = await sha256(clientIp(request), config.secret("IP_HASH_SALT", "suggestion"));
    const { data, error } = await service.rpc("insert_site_suggestion", {
      p_name: form.name,
      p_area: form.area,
      p_message: form.message,
      p_sender_hash: senderHash,
    });
    if (error) throw error;
    if (data.status === "rate_limited") {
      throw new UserError(429, "rate_limited", "Du har skickat många förslag på kort tid. Vänta en stund och försök igen.");
    }

    // Elevate Studio, who looks after the website, gets them by e-mail; the customer sees them in the admin.
    await sendMail({
      to: config.agencyEmail(),
      subject: `Förbättringsförslag från ${form.name}`,
      blocks: [
        block.heading("Nytt förslag för hemsidan"),
        block.rows([
          ["Från", form.name],
          ["Gäller", form.area || "–"],
          ["Förslag", form.message],
        ]),
        block.button("Öppna i adminpanelen", `${config.adminUrl()}/hemsidan/?flik=forslag`),
      ],
    });
    return json(request, { ok: true });
  })
);
