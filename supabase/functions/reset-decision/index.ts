// Where the approve/deny links in the reset e-mail lead. Checks the signature, the expiry and the one-time token, then
// either resets the site (after a backup) or turns the request down, tells both sides and shows a short answer page.
import { serviceClient } from "../_shared/supabase.ts";
import { safeEqual, sha256 } from "../_shared/crypto.ts";
import { block, sendMail } from "../_shared/email.ts";
import { config } from "../_shared/env.ts";
import { triggerDeploy } from "../_shared/deploy.ts";
import { expireOverdueRequests, linkIsSigned } from "../_shared/reset.ts";

function page(title: string, text: string, status = 200): Response {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    if (!id || !["approve", "deny"].includes(action) || !(await linkIsSigned(id, action, exp, token, sig))) {
      return page("Länken är inte giltig", "Länken är felaktig eller ofullständig.", 400);
    }
    await expireOverdueRequests();
    if (Number(exp) < Date.now()) return page("Länken har gått ut", "Begäran gick ut efter 72 timmar och ingenting har ändrats.", 410);

    const service = serviceClient();
    const { data: request_ } = await service.from("reset_requests").select("*").eq("id", id).maybeSingle();
    if (!request_ || !safeEqual(request_.token_hash, await sha256(token))) return page("Länken är inte giltig", "Det finns ingen sådan begäran.", 404);
    if (request_.status !== "pending") {
      const states: Record<string, string> = {
        approved: "Begäran är redan godkänd och hemsidan är återställd.",
        denied: "Begäran är redan nekad.",
        cancelled: "Kunden har själv återkallat begäran.",
        expired: "Begäran har gått ut.",
      };
      return page("Redan behandlad", states[request_.status] ?? "Begäran är redan behandlad.", 409);
    }

    const { data: requester } = await service.from("profiles").select("email").eq("id", request_.requested_by).maybeSingle();
    const recipients = [config.agencyEmail(), ...(requester?.email ? [requester.email] : [])];

    if (action === "deny") {
      await service.from("reset_requests").update({ status: "denied", decided_at: new Date().toISOString(), decided_by: config.agencyEmail() }).eq("id", id).eq("status", "pending");
      await service.from("audit_log").insert({ action: "reset.denied", entity: id, actor_label: config.agencyEmail() });
      if (requester?.email) {
        await sendMail({
          to: requester.email,
          subject: "Din begäran om att rensa ändringar godkändes inte",
          blocks: [
            block.heading("Begäran nekades"),
            block.text("Elevate Studio har inte godkänt begäran om att rensa alla ändringar, så ingenting har ändrats på hemsidan. Hör gärna av dig till dem om du har frågor."),
          ],
        });
      }
      return page("Begäran nekad", "Ingenting har ändrats. Kunden har fått ett mejl om beslutet.");
    }

    const { data: result, error } = await service.rpc("reset_to_baseline", { p_request_id: id, p_decided_by: config.agencyEmail() });
    if (error) throw error;
    if (result.status !== "published") return page("Redan behandlad", "Begäran kunde inte genomföras eftersom den inte längre väntar.", 409);
    const deploy = await triggerDeploy(result.version);
    await sendMail({
      to: recipients,
      subject: "Hemsidan är återställd till ursprungsversionen",
      blocks: [
        block.heading("Ändringarna är rensade"),
        block.text("Hemsidan är återställd till sin ursprungliga version. En säkerhetskopia av versionen innan finns i versionshistoriken, så det går att ångra."),
        block.text(deploy.started ? "Den publicerade hemsidan uppdateras inom ett par minuter." : deploy.message ?? ""),
        block.button("Till adminpanelen", `${config.adminUrl()}/`),
      ],
    });
    return page("Godkänt", "Hemsidan är återställd och uppdateras inom ett par minuter. En säkerhetskopia finns i versionshistoriken.");
  } catch (error) {
    console.error(error);
    return page("Något gick fel", "Begäran kunde inte behandlas just nu. Försök igen om en stund.", 500);
  }
});
