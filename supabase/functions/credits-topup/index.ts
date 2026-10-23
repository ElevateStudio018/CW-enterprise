// "Fyll på credits": adds a pack straight away and puts it on the annual invoice. Mails the customer a confirmation and
// Elevate Studio the order. More than three orders in a day wait for Elevate Studio's approval instead.
import { z } from "zod";
import { handle, json, readJson, UserError } from "../_shared/http.ts";
import { audit, requireAdmin, serviceClient } from "../_shared/supabase.ts";
import { block, sendMail } from "../_shared/email.ts";
import { config } from "../_shared/env.ts";

const schema = z.object({ credits: z.number().int().positive() });

const formatPrice = (price: number | null) =>
  price === null ? "Enligt avtal" : `${price.toLocaleString("sv-SE", { minimumFractionDigits: 0 })} kr exkl. moms`;

Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const { user } = await requireAdmin(request);
    const parsed = schema.safeParse(await readJson(request, 2_000));
    if (!parsed.success) throw new UserError(400, "invalid", "Välj ett paket.");

    const service = serviceClient();
    const { data: packsRow } = await service.from("settings").select("value").eq("key", "credit_packs").single();
    const packs = (packsRow?.value ?? []) as { credits: number; price: number | null }[];
    const pack = packs.find((p) => p.credits === parsed.data.credits);
    if (!pack) throw new UserError(400, "invalid", "Det paketet finns inte.");

    const { data: result, error } = await service.rpc("credits_topup", {
      p_pack: pack.credits,
      p_credits: pack.credits,
      p_price: pack.price ?? 0,
      p_actor: user.id,
    });
    if (error) throw error;

    const { data: snapshot } = await service.from("site_snapshot").select("data").eq("id", 1).single();
    const companyName: string = snapshot?.data?.company?.legalName ?? "";
    const customerEmail = user.email ?? "";
    const when = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });
    const pending = result.status === "pending_approval";

    if (customerEmail) {
      await sendMail({
        to: customerEmail,
        subject: pending ? "Din beställning av credits väntar på godkännande" : `${pack.credits} credits har lagts till`,
        blocks: [
          block.heading(pending ? "Beställningen är mottagen" : "Tack för din beställning"),
          block.text(
            pending
              ? "Du har gjort flera beställningar i dag, så Elevate Studio godkänner den här innan den läggs till. Du får besked så snart det är klart."
              : "Dina credits finns redan på kontot och kan användas direkt."
          ),
          block.rows([
            ["Paket", `${pack.credits} credits`],
            ["Pris", formatPrice(pack.price)],
            ["Betalning", "Läggs på årsfakturan"],
            ["Nytt saldo", `${result.balance} credits`],
          ]),
          block.button("Till adminpanelen", `${config.adminUrl()}/`),
        ],
      });
    }
    await sendMail({
      to: config.agencyEmail(),
      subject: `${pending ? "Att godkänna: " : ""}Credits beställda – ${companyName || "kund"}`,
      blocks: [
        block.heading(pending ? "Beställning som väntar på godkännande" : "Ny beställning av credits"),
        block.rows([
          ["Företag", companyName || "–"],
          ["Beställd av", customerEmail || "–"],
          ["Paket", `${pack.credits} credits`],
          ["Pris", formatPrice(pack.price)],
          ["Tid", when],
          ["Status", pending ? "Väntar på godkännande (fler än tre beställningar på ett dygn)" : "Tillagd, ej fakturerad"],
          ["Kontots saldo", `${result.balance} credits`],
          ["Order-id", String(result.orderId)],
        ]),
      ],
    });
    await audit("credits.topup_requested", String(result.orderId), null, { credits: pack.credits, status: result.status }, user.id);
    return json(request, { status: result.status, balance: result.balance, orderId: result.orderId });
  })
);
