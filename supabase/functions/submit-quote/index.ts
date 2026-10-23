// The public quote form: checks what was sent, stores it for the admin's list and e-mails the company.
import { z } from "zod";
import { clientIp, handle, json, readJson, UserError } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sha256 } from "../_shared/crypto.ts";
import { block, sendMail } from "../_shared/email.ts";
import { optionalEnv, config } from "../_shared/env.ts";
import { fill } from "../_shared/site/format.ts";

const requestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).regex(/^[\d\s()+-]*$/),
  email: z.union([z.literal(""), z.string().trim().max(200).email()]),
  workType: z.string().trim().max(200),
  message: z.string().trim().max(5000),
  /** Left empty by people; filled in by bots that fill in every field. */
  website: z.string().max(500).optional(),
});

Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const parsed = requestSchema.safeParse(await readJson(request, 20_000));
    if (!parsed.success) throw new UserError(400, "invalid", "Kontrollera fälten och försök igen.");
    const form = parsed.data;
    if (!form.phone && !form.email) throw new UserError(400, "invalid", "Ange telefonnummer eller e-postadress.");
    // A bot: thank it and do nothing.
    if (form.website) return json(request, { ok: true });

    const service = serviceClient();
    const senderHash = await sha256(clientIp(request), config.secret("IP_HASH_SALT", "quote"));
    const { data, error } = await service.rpc("insert_quote_request", {
      p_name: form.name,
      p_phone: form.phone,
      p_email: form.email,
      p_work_type: form.workType,
      p_message: form.message,
      p_sender_hash: senderHash,
    });
    if (error) throw error;
    if (data.status === "rate_limited") {
      throw new UserError(429, "rate_limited", "Du har skickat flera förfrågningar på kort tid. Ring oss gärna istället.");
    }

    // Until launch the requests go to Elevate Studio; at launch QUOTE_NOTIFY_EMAIL is set to the company's address.
    const { data: snapshot } = await service.from("site_snapshot").select("data").eq("id", 1).single();
    const site = snapshot?.data;
    const to = optionalEnv("QUOTE_NOTIFY_EMAIL") ?? config.agencyEmail();
    if (to) {
      await sendMail({
        to,
        replyTo: form.email || undefined,
        subject: fill(site?.form?.emailSubject ?? "Offertförfrågan från {namn}", { namn: form.name }),
        blocks: [
          block.heading("Ny offertförfrågan"),
          block.rows([
            ["Namn", form.name],
            ["Telefon", form.phone || "–"],
            ["E-post", form.email || "–"],
            ["Typ av arbete", form.workType || "–"],
            ["Beskrivning", form.message || "–"],
          ]),
          block.button("Öppna i adminpanelen", `${config.adminUrl()}/offertforfragningar/`),
        ],
      });
    }
    return json(request, { ok: true });
  })
);
