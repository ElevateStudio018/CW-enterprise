// E-mail through Resend (resend.com). RESEND_API_URL can point elsewhere for tests. All mail is HTML with a plain-text
// twin, in a simple layout in the site's colours.
import { env, optionalEnv } from "./env.ts";

export interface Mail {
  to: string | string[];
  subject: string;
  /** Paragraphs and other blocks, see block helpers below. */
  blocks: string[];
  replyTo?: string;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const block = {
  heading: (text: string) => `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#222222">${escapeHtml(text)}</h1>`,
  text: (text: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#333333">${escapeHtml(text)}</p>`,
  rows: (rows: [string, string][]) =>
    `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 18px">${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #e3e1d8;font-size:14px;color:#63625C;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #e3e1d8;font-size:15px;color:#222222">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`
      )
      .join("")}</table>`,
  button: (label: string, href: string, tone: "primary" | "danger" = "primary") =>
    `<p style="margin:8px 0 18px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${
      tone === "danger" ? "#8B1D1D" : "#1C2817"
    };color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:0.03em">${escapeHtml(label)}</a></p>`,
  small: (text: string) => `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#63625C">${escapeHtml(text)}</p>`,
};

function html(mail: Mail): string {
  return `<!doctype html><html lang="sv"><body style="margin:0;background:#E3E1D8;font-family:Figtree,Arial,sans-serif">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px">
<table role="presentation" style="max-width:560px;margin:0 auto;border-collapse:collapse;background:#F2F0E9">
<tr><td style="background:#121418;padding:18px 28px;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">CW Enterprise · Adminpanel</td></tr>
<tr><td style="padding:28px">${mail.blocks.join("")}</td></tr>
</table></td></tr></table></body></html>`;
}

function plain(mail: Mail): string {
  return mail.blocks
    .map((b) =>
      b
        .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, "$2: $1")
        .replace(/<\/(p|h1|tr)>/g, "\n")
        .replace(/<\/td><td[^>]*>/g, ": ")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    )
    .join("\n")
    .trim();
}

/** Sends one e-mail; returns false (and logs) instead of throwing, so a mail problem never undoes the action itself. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const apiKey = optionalEnv("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set; e-mail not sent:", mail.subject);
    return false;
  }
  try {
    const response = await fetch(`${env("RESEND_API_URL", "https://api.resend.com")}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("EMAIL_FROM", "CW Enterprise <onboarding@resend.dev>"),
        to: Array.isArray(mail.to) ? mail.to : [mail.to],
        subject: mail.subject,
        html: html(mail),
        text: plain(mail),
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
    });
    if (!response.ok) {
      console.error("Resend refused the e-mail:", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Could not reach Resend:", error);
    return false;
  }
}
