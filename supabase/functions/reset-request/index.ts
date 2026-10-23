// "Rensa alla ändringar": registers the request and e-mails Elevate Studio signed links to approve or deny it. Nothing
// changes until they approve. DELETE withdraws a pending request; GET reports the current one.
import { z } from "zod";
import { handle, json, readJson, UserError } from "../_shared/http.ts";
import { audit, requireAdmin, serviceClient } from "../_shared/supabase.ts";
import { randomToken, sha256 } from "../_shared/crypto.ts";
import { block, sendMail } from "../_shared/email.ts";
import { config } from "../_shared/env.ts";
import { decisionLink, expireOverdueRequests } from "../_shared/reset.ts";

const schema = z.object({ confirm: z.literal("RENSA"), reason: z.string().trim().max(1000).optional() });
const HOURS_VALID = 72;

Deno.serve(
  handle(async (request) => {
    const { user } = await requireAdmin(request);
    const service = serviceClient();
    await expireOverdueRequests();

    const pending = async () =>
      (await service.from("reset_requests").select("id, status, reason, created_at, expires_at").eq("status", "pending").maybeSingle()).data;

    if (request.method === "GET") return json(request, { pending: await pending() });

    if (request.method === "DELETE") {
      const current = await pending();
      if (!current) throw new UserError(404, "none", "Det finns ingen begäran att återkalla.");
      await service.from("reset_requests").update({ status: "cancelled", decided_at: new Date().toISOString(), decided_by: user.email }).eq("id", current.id);
      await audit("reset.cancelled", current.id, null, null, user.id);
      await sendMail({
        to: config.agencyEmail(),
        subject: "Begäran om att rensa ändringar har återkallats",
        blocks: [block.heading("Begäran återkallad"), block.text(`${user.email} har själv återkallat sin begäran. Länkarna i det tidigare mejlet fungerar inte längre.`)],
      });
      return json(request, { status: "cancelled" });
    }

    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const parsed = schema.safeParse(await readJson(request, 5_000));
    if (!parsed.success) throw new UserError(400, "confirm", "Skriv RENSA för att bekräfta.");
    if (await pending()) throw new UserError(409, "already_pending", "Det finns redan en begäran som väntar på godkännande.");

    const { data: snapshot, error: snapshotError } = await service.from("site_snapshot").select("version, data").eq("id", 1).single();
    if (snapshotError || !snapshot) throw snapshotError ?? new Error("No published snapshot");
    const token = randomToken();
    const expires = Date.now() + HOURS_VALID * 60 * 60 * 1000;
    const { data: created, error } = await service
      .from("reset_requests")
      .insert({
        requested_by: user.id,
        reason: parsed.data.reason ?? "",
        snapshot_version: snapshot.version,
        token_hash: await sha256(token),
        expires_at: new Date(expires).toISOString(),
      })
      .select("id, created_at, expires_at")
      .single();
    if (error) throw error;
    await audit("reset.requested", created.id, null, { reason: parsed.data.reason ?? "", version: snapshot.version }, user.id);

    const company: string = snapshot.data?.company?.legalName ?? "";
    const when = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });
    await sendMail({
      to: config.agencyEmail(),
      subject: `Godkänn rensning av hemsidan – ${company || "kund"}`,
      blocks: [
        block.heading("Begäran om att rensa alla ändringar"),
        block.text("Kunden vill återställa hemsidan till den ursprungliga versionen. Alla ändringar av texter, färger, typsnitt och sektioner tas bort. Offertförfrågningar, bilder, credits och historik påverkas inte, och en säkerhetskopia tas först."),
        block.rows([
          ["Företag", company || "–"],
          ["Begärd av", user.email ?? "–"],
          ["Tid", when],
          ["Nuvarande version", String(snapshot.version)],
          ["Anledning", parsed.data.reason || "–"],
        ]),
        block.button("Godkänn", await decisionLink(created.id, "approve", expires, token)),
        block.button("Neka", await decisionLink(created.id, "deny", expires, token), "danger"),
        block.small(`Länkarna fungerar en gång och går ut om ${HOURS_VALID} timmar. Görs inget så händer ingenting.`),
      ],
    });
    if (user.email) {
      await sendMail({
        to: user.email,
        subject: "Din begäran om att rensa ändringar är registrerad",
        blocks: [
          block.heading("Begäran mottagen"),
          block.text("Din begäran om att rensa alla ändringar väntar nu på godkännande från Elevate Studio. Ingenting har ändrats på hemsidan än."),
          block.text("Du får ett mejl när begäran har behandlats. Ångrar du dig kan du återkalla den i adminpanelen."),
          block.button("Till adminpanelen", `${config.adminUrl()}/installningar/?flik=farozon`),
        ],
      });
    }
    return json(request, { status: "pending", pending: { id: created.id, created_at: created.created_at, expires_at: created.expires_at } });
  })
);
