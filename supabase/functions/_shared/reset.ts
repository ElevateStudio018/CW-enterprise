// The signed one-time links in the reset approval e-mail, and telling the customer about a request that ran out.
import { hmac, safeEqual } from "./crypto.ts";
import { env, config } from "./env.ts";
import { serviceClient } from "./supabase.ts";
import { block, sendMail } from "./email.ts";

export type ResetAction = "approve" | "deny";

const signingSecret = () => config.secret("RESET_SIGNING_SECRET", "reset-links");
/** The functions' public address, for links in e-mails (inside the platform SUPABASE_URL may be an internal one). */
export const functionsUrl = () => env("FUNCTIONS_PUBLIC_URL", `${env("SUPABASE_URL")}/functions/v1`);

export async function decisionLink(id: string, action: ResetAction, expires: number, token: string): Promise<string> {
  const sig = await hmac(signingSecret(), `${id}.${action}.${expires}.${token}`);
  const query = new URLSearchParams({ id, action, exp: String(expires), token, sig });
  return `${functionsUrl()}/reset-decision?${query}`;
}

export async function linkIsSigned(id: string, action: string, expires: string, token: string, sig: string): Promise<boolean> {
  return safeEqual(sig, await hmac(signingSecret(), `${id}.${action}.${expires}.${token}`));
}

/** Marks pending requests whose time has run out as expired, and tells whoever asked. */
export async function expireOverdueRequests(): Promise<void> {
  const service = serviceClient();
  const { data: overdue } = await service
    .from("reset_requests")
    .update({ status: "expired", decided_at: new Date().toISOString(), decided_by: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id, requested_by");
  for (const request of overdue ?? []) {
    const { data: profile } = await service.from("profiles").select("email").eq("id", request.requested_by).maybeSingle();
    if (profile?.email) {
      await sendMail({
        to: profile.email,
        subject: "Din begäran om att rensa ändringar godkändes inte",
        blocks: [
          block.heading("Begäran gick ut"),
          block.text("Elevate Studio hann inte godkänna din begäran om att rensa alla ändringar inom 72 timmar, så ingenting har ändrats på hemsidan."),
          block.text("Vill du fortfarande rensa ändringarna kan du göra en ny begäran i adminpanelen, eller höra av dig till Elevate Studio."),
          block.button("Till adminpanelen", `${config.adminUrl()}/installningar/?flik=farozon`),
        ],
      });
    }
    await service.from("audit_log").insert({ action: "reset.expired", entity: request.id, actor: request.requested_by });
  }
}
