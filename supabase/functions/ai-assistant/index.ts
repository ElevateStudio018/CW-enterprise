// Elevate AI: the admin's assistant. Every model call happens here; the API key never reaches the browser.
//
//   send     – the owner's message: answered, or planned as a change with its price (nothing is changed or charged)
//   approve  – the plan is approved: the change set is made, checked against the content rules (one automatic retry),
//              priced from what it contains and shown as a preview (still nothing charged)
//   publish  – the previewed change is published as a new version and the credits are charged
//   discard  – the proposal is dropped; nothing was charged
//   rollback – a published AI change is undone while it is the latest version; the credits are refunded
//
// send and approve stream their progress as server-sent events and stop (charging nothing) if the browser goes away.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { corsHeaders, handle, json, readJson, UserError } from "../_shared/http.ts";
import { audit, requireAdmin, serviceClient } from "../_shared/supabase.ts";
import { config, optionalEnv } from "../_shared/env.ts";
import { triggerDeploy } from "../_shared/deploy.ts";
import type { SiteData, SiteImage } from "../_shared/site/schema.ts";
import {
  applyChangeSet,
  changeSetJsonSchema,
  changeSetSchema,
  compactForModel,
  imagesBySrc,
  planJsonSchema,
  planSchema,
  priceChangeSet,
  priceOfPlan,
  type ChangeSet,
  type Operation,
  type Plan,
  type PriceLine,
} from "../_shared/site/changeset.ts";
import { assistantContext, assistantInstructions, changeInstructions, planInstructions, retryInstructions, siteIntro } from "../_shared/site/assistant.ts";
import { describePath } from "../_shared/site/changes.ts";
import type { Patch } from "../_shared/site/paths.ts";

const MODEL = "claude-opus-5-5";
const MESSAGES_PER_HOUR = 30;
const HISTORY = 24;
const BUCKET = "site-images";

const sendSchema = z.object({
  action: z.literal("send"),
  conversationId: z.string().uuid().nullish(),
  text: z.string().trim().min(1).max(4000),
  attachments: z.array(z.string().uuid()).max(4).default([]),
});
const messageAction = z.object({ action: z.enum(["approve", "publish", "discard", "rollback"]), messageId: z.string().uuid() });

interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  attachments: { imageId: string; src: string; alt: string }[];
  plan: (Plan & { lines: PriceLine[]; total: number }) | null;
  change_set: StoredChangeSet | null;
  credit_cost: number;
  status: string;
  revision_id: number | null;
  created_at: string;
}

interface StoredChangeSet extends ChangeSet {
  patches: Patch[];
  marker: string;
  lines: PriceLine[];
  computedTotal: number;
  changes: string[];
}

const statusNotes: Record<string, string> = {
  estimated: "väntar på ägarens godkännande",
  generating: "avbröts innan den var klar",
  preview: "visas som förhandsvisning, inte publicerad",
  published: "publicerad",
  discarded: "ångrad av ägaren innan publicering",
  cancelled: "avbruten",
  failed: "misslyckades, inget ändrades",
  rolled_back: "publicerades och ångrades sedan",
};

function anthropic(): Anthropic {
  const apiKey = optionalEnv("ANTHROPIC_API_KEY");
  if (!apiKey) throw new UserError(503, "ai_off", "AI-assistenten är inte påslagen än. Kontakta Elevate Studio.");
  return new Anthropic({ apiKey, baseURL: optionalEnv("ANTHROPIC_API_URL"), maxRetries: 2 });
}

function publicUrl(path: string): string {
  return `${config.supabaseUrl()}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** An uploaded image as the content refers to it (as in the admin's lib/admin/images.ts). */
function siteImage(row: { id: string; alt_text: string; focal_point: { x: number; y: number }; variants: { width: number; path: string }[] }): SiteImage {
  const sorted = [...row.variants].sort((a, b) => a.width - b.width);
  return {
    src: publicUrl(sorted[sorted.length - 1].path),
    variants: sorted.map((variant) => ({ width: variant.width, src: publicUrl(variant.path) })),
    alt: row.alt_text,
    focus: `${Math.round(row.focal_point.x)}% ${Math.round(row.focal_point.y)}%`,
    imageId: row.id,
  };
}

/** The text so far of one string field in JSON that is still being written. */
function partialString(source: string, key: string): string {
  const start = source.indexOf(`"${key}"`);
  if (start < 0) return "";
  const colon = source.indexOf(":", start + key.length + 2);
  const quote = source.indexOf('"', colon + 1);
  if (colon < 0 || quote < 0) return "";
  let out = "";
  for (let i = quote + 1; i < source.length; i++) {
    const char = source[i];
    if (char === '"') return out;
    if (char !== "\\") {
      out += char;
      continue;
    }
    const next = source[i + 1];
    if (next === undefined) return out;
    if (next === "u") {
      const hex = source.slice(i + 2, i + 6);
      if (hex.length < 4) return out;
      out += String.fromCharCode(Number.parseInt(hex, 16));
      i += 5;
    } else {
      out += { n: "\n", t: "\t", r: "", b: "", f: "", '"': '"', "\\": "\\", "/": "/" }[next] ?? next;
      i += 1;
    }
  }
  return out;
}

/** A Swedish message for what went wrong talking to the model. */
function modelError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "AI-tjänsten är inte rätt inställd. Kontakta Elevate Studio.";
  }
  if (error instanceof Anthropic.RateLimitError) return "AI:n har mycket att göra just nu. Vänta en minut och försök igen.";
  if (error instanceof Anthropic.APIConnectionError) return "AI-tjänsten gick inte att nå. Försök igen om en stund.";
  if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) return "AI-tjänsten har tillfälliga problem. Försök igen om en stund.";
  return "Något gick fel med AI:n. Försök igen.";
}

class Refused extends Error {}

/** One streamed model call with the site as context and a JSON answer in the given format. */
async function callModel(options: {
  client: Anthropic;
  system: Anthropic.Beta.BetaTextBlockParam[];
  messages: Anthropic.Beta.BetaMessageParam[];
  schema: Record<string, unknown>;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  signal: AbortSignal;
  onText?: (soFar: string) => void;
}): Promise<string> {
  const stream = options.client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: options.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: options.effort, format: { type: "json_schema", schema: options.schema } },
      system: options.system,
      messages: options.messages,
    },
    { signal: options.signal }
  );
  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      options.onText?.(text);
    }
  }
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Refused();
  if (message.stop_reason === "max_tokens") throw new Error("The answer was cut off (max_tokens)");
  return message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
}

/** Server-sent events to the browser; the controller aborts the model call when the browser goes away. */
function eventStream(request: Request, run: (send: (event: Record<string, unknown>) => void, signal: AbortSignal) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          abort.abort();
        }
      };
      try {
        await run(send, abort.signal);
      } catch (error) {
        console.error(error);
        send({ type: "error", message: error instanceof UserError ? error.message : "Något gick fel. Försök igen." });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the browser leaving.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(body, {
    headers: { ...corsHeaders(request), "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const { user, client: asUser } = await requireAdmin(request);
    const service = serviceClient();
    const body = await readJson<Record<string, unknown>>(request, 50_000);

    /** The draft as the admin sees it, with the fingerprint that publishing checks. */
    async function loadDraft(): Promise<{ draft: SiteData; marker: string }> {
      const { data, error } = await asUser.rpc("content_draft");
      if (error) throw error;
      return { draft: data.draft as SiteData, marker: data.marker as string };
    }

    async function loadLibrary(): Promise<SiteImage[]> {
      const { data } = await service.from("website_images").select("id, alt_text, focal_point, variants").order("created_at", { ascending: false }).limit(60);
      return (data ?? []).map(siteImage);
    }

    async function conversationMessages(conversationId: string): Promise<MessageRow[]> {
      const { data, error } = await service.from("ai_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    }

    /** The conversation as the model reads it: the owner's words and pictures, and what came of each proposal. */
    function history(rows: MessageRow[]): Anthropic.Beta.BetaMessageParam[] {
      const recent = rows.slice(-HISTORY);
      // The conversation the model sees starts with something the owner said.
      while (recent.length > 0 && recent[0].role !== "user") recent.shift();
      return recent.map((row) => {
        if (row.role === "user") {
          const images: Anthropic.Beta.BetaContentBlockParam[] = row.attachments.map((attachment) => ({ type: "image", source: { type: "url", url: attachment.src } }));
          const list = row.attachments.length
            ? `\n\nBifogade bilder (använd src exakt):\n${row.attachments.map((attachment) => `- src ${attachment.src} – ${attachment.alt}`).join("\n")}`
            : "";
          return { role: "user", content: [...images, { type: "text", text: row.content + list }] };
        }
        const note = row.plan?.kind === "change" ? `\n\n[Förslag: ${row.plan.summary} – ${statusNotes[row.status] ?? row.status}]` : "";
        return { role: "assistant", content: (row.change_set?.summary ?? row.content) + note };
      });
    }

    function system(draft: SiteData, library: SiteImage[], mode: string): Anthropic.Beta.BetaTextBlockParam[] {
      return [
        { type: "text", text: assistantInstructions(), cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: `${siteIntro(draft)}\n\n${assistantContext(compactForModel(draft), library.map((image) => ({ src: image.src, alt: image.alt })))}`,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: mode },
      ];
    }

    async function loadMessage(id: string): Promise<MessageRow> {
      const { data, error } = await service.from("ai_messages").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data || data.role !== "assistant") throw new UserError(404, "not_found", "Förslaget finns inte längre.");
      return data as MessageRow;
    }

    // -----------------------------------------------------------------------------------------------------------------
    if (body.action === "send") {
      const parsed = sendSchema.safeParse(body);
      if (!parsed.success) throw new UserError(400, "invalid", "Skriv ett meddelande (högst 4 000 tecken).");
      const { text, attachments } = parsed.data;

      const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const { count } = await service.from("ai_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", hourAgo);
      if ((count ?? 0) >= MESSAGES_PER_HOUR) {
        throw new UserError(429, "rate_limited", `Du har skickat ${MESSAGES_PER_HOUR} meddelanden den senaste timmen. Vänta en stund och skriv sedan igen.`);
      }
      const client = anthropic();

      let conversationId = parsed.data.conversationId ?? null;
      if (conversationId) {
        const { data } = await service.from("ai_conversations").select("id").eq("id", conversationId).maybeSingle();
        if (!data) throw new UserError(404, "not_found", "Konversationen finns inte längre.");
      } else {
        const title = text.replace(/\s+/g, " ").slice(0, 60) + (text.length > 60 ? "…" : "");
        const { data, error } = await service.from("ai_conversations").insert({ title, created_by: user.id }).select("id").single();
        if (error) throw error;
        conversationId = data.id as string;
      }

      let attached: MessageRow["attachments"] = [];
      if (attachments.length > 0) {
        const { data } = await service.from("website_images").select("id, alt_text, focal_point, variants").in("id", attachments);
        attached = (data ?? []).map((row) => {
          const image = siteImage(row);
          return { imageId: row.id as string, src: image.src, alt: image.alt };
        });
      }
      const { data: userRow, error: userError } = await service
        .from("ai_messages")
        .insert({ conversation_id: conversationId, role: "user", content: text, attachments: attached })
        .select("*")
        .single();
      if (userError) throw userError;

      const [{ draft }, library, rows] = await Promise.all([loadDraft(), loadLibrary(), conversationMessages(conversationId)]);

      return eventStream(request, async (send, signal) => {
        send({ type: "start", conversationId, message: userRow });
        let reply = "";
        let raw: string;
        try {
          raw = await callModel({
            client,
            system: system(draft, library, planInstructions),
            messages: history(rows),
            schema: planJsonSchema,
            effort: "low",
            maxTokens: 8000,
            signal,
            onText: (soFar) => {
              const next = partialString(soFar, "reply");
              if (next.length > reply.length) {
                send({ type: "reply", text: next.slice(reply.length) });
                reply = next;
              }
            },
          });
        } catch (error) {
          const cancelled = signal.aborted || error instanceof Anthropic.APIUserAbortError;
          const content = cancelled ? "Avbrutet." : error instanceof Refused ? "Det kan jag tyvärr inte hjälpa till med." : modelError(error);
          const { data: row } = await service
            .from("ai_messages")
            .insert({ conversation_id: conversationId, role: "assistant", content, status: cancelled ? "cancelled" : "failed" })
            .select("*")
            .single();
          if (!cancelled) console.error(error);
          send({ type: "done", message: row });
          return;
        }

        const plan = planSchema.safeParse(JSON.parse(raw));
        if (!plan.success) {
          const { data: row } = await service
            .from("ai_messages")
            .insert({ conversation_id: conversationId, role: "assistant", content: "Jag förstod inte riktigt. Kan du beskriva det på ett annat sätt?", status: "failed" })
            .select("*")
            .single();
          send({ type: "done", message: row });
          return;
        }
        const price = priceOfPlan(plan.data);
        const isChange = plan.data.kind === "change" && plan.data.items.length > 0;
        const { data: row, error } = await service
          .from("ai_messages")
          .insert({
            conversation_id: conversationId,
            role: "assistant",
            content: plan.data.reply,
            plan: { ...plan.data, lines: price.lines, total: price.total },
            credit_cost: isChange ? price.total : 0,
            status: isChange ? "estimated" : "done",
          })
          .select("*")
          .single();
        if (error) throw error;
        await service.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
        send({ type: "done", message: row });
      });
    }

    // -----------------------------------------------------------------------------------------------------------------
    const parsed = messageAction.safeParse(body);
    if (!parsed.success) throw new UserError(400, "invalid", "Ogiltig förfrågan.");
    const message = await loadMessage(parsed.data.messageId);

    if (parsed.data.action === "approve") {
      const stale = message.status === "generating" && Date.now() - new Date(message.created_at).getTime() > 10 * 60_000;
      if (message.status !== "estimated" && !stale) throw new UserError(409, "not_estimated", "Förslaget har redan hanterats.");
      if (!message.plan) throw new UserError(409, "no_plan", "Förslaget saknar en plan.");
      const { data: balance } = await service.from("credit_balance").select("balance").eq("account_id", "site").maybeSingle();
      if ((balance?.balance ?? 0) < message.credit_cost) {
        throw new UserError(402, "insufficient_credits", "Du har inte tillräckligt med credits för den här ändringen. Fyll på under Inställningar → Credits.");
      }
      const client = anthropic();
      await service.from("ai_messages").update({ status: "generating" }).eq("id", message.id);

      const [{ draft, marker }, library, rows] = await Promise.all([loadDraft(), loadLibrary(), conversationMessages(message.conversation_id)]);
      const known = imagesBySrc(draft);
      for (const image of library) known.set(image.src, image);
      const upTo = rows.findIndex((row) => row.id === message.id);
      const plan = message.plan;
      const approval = `Jag godkänner förslaget. Genomför det nu: ${plan.summary}\n${plan.items.map((item) => `- ${item.description}`).join("\n")}`;
      const messages: Anthropic.Beta.BetaMessageParam[] = [...history(rows.slice(0, upTo + 1)), { role: "user", content: approval }];

      return eventStream(request, async (send, signal) => {
        const fail = async (status: "failed" | "cancelled", content: string) => {
          const { data: row } = await service.from("ai_messages").update({ status, content: `${message.content}\n\n${content}` }).eq("id", message.id).select("*").single();
          send({ type: "done", message: row });
        };

        let attempt = 0;
        let reported = 0;
        let lastProblems: string[] = [];
        let conversation = messages;
        while (attempt < 2) {
          attempt++;
          send({ type: "status", text: attempt === 1 ? "Gör ändringen…" : "Rättar till förslaget…" });
          let raw: string;
          try {
            raw = await callModel({
              client,
              system: system(draft, library, changeInstructions),
              messages: conversation,
              schema: changeSetJsonSchema,
              effort: "medium",
              maxTokens: 32000,
              signal,
              onText: (soFar) => {
                // A sign of life now and then, not one per token.
                if (soFar.length - reported >= 400) {
                  reported = soFar.length;
                  send({ type: "progress", chars: soFar.length });
                }
              },
            });
          } catch (error) {
            if (signal.aborted || error instanceof Anthropic.APIUserAbortError) return fail("cancelled", "Avbrutet – inget ändrades och inga credits drogs.");
            if (error instanceof Refused) return fail("failed", "Den ändringen kan jag tyvärr inte göra. Inga credits drogs.");
            console.error(error);
            return fail("failed", `${modelError(error)} Inga credits drogs.`);
          }
          send({ type: "status", text: "Kontrollerar ändringen…" });
          let changeSet: ChangeSet | null = null;
          try {
            const checked = changeSetSchema.safeParse(JSON.parse(raw));
            if (checked.success) changeSet = checked.data;
            else lastProblems = checked.error.issues.slice(0, 10).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
          } catch {
            lastProblems = ["The answer was not valid JSON."];
          }
          if (changeSet) {
            const applied = applyChangeSet(draft, changeSet.operations as Operation[], known);
            if (applied.doc && applied.problems.length === 0) {
              const price = priceChangeSet(draft, applied.doc, changeSet.operations as Operation[]);
              const cost = Math.min(price.total, message.credit_cost);
              const stored: StoredChangeSet = {
                ...changeSet,
                patches: applied.patches,
                marker,
                lines: price.lines,
                computedTotal: price.total,
                changes: Array.from(new Set(applied.patches.map((patch) => describePath(applied.doc, patch.path.slice(0, Math.min(patch.path.length, 9)))))).slice(0, 30),
              };
              const { data: row, error } = await service
                .from("ai_messages")
                .update({ status: "preview", change_set: stored, credit_cost: cost })
                .eq("id", message.id)
                .select("*")
                .single();
              if (error) throw error;
              await audit("ai.preview", message.id, null, { cost, operations: changeSet.operations.length }, user.id);
              send({ type: "done", message: row });
              return;
            }
            lastProblems = applied.problems;
          }
          conversation = [...messages, { role: "assistant", content: raw }, { role: "user", content: retryInstructions(lastProblems) }];
        }
        console.error("change set rejected twice", lastProblems);
        await fail("failed", "Jag kunde inte göra ändringen så att den håller måttet, så inget ändrades och inga credits drogs. Prova att beskriva den lite annorlunda eller dela upp den i mindre steg.");
      });
    }

    if (parsed.data.action === "discard") {
      if (message.status !== "estimated" && message.status !== "preview") throw new UserError(409, "not_open", "Förslaget har redan hanterats.");
      const { data: row } = await service.from("ai_messages").update({ status: "discarded" }).eq("id", message.id).select("*").single();
      await audit("ai.discarded", message.id, null, null, user.id);
      return json(request, { message: row });
    }

    if (parsed.data.action === "publish") {
      if (message.status !== "preview" || !message.change_set) throw new UserError(409, "not_preview", "Förslaget kan inte publiceras längre.");
      const stored = message.change_set;
      for (let attempt = 0; attempt < 2; attempt++) {
        let { patches } = stored;
        const { draft, marker } = await loadDraft();
        // If the site changed since the preview was made, the change is made again on the site as it is now.
        if (marker !== stored.marker) {
          const known = imagesBySrc(draft);
          for (const image of await loadLibrary()) known.set(image.src, image);
          const applied = applyChangeSet(draft, stored.operations, known);
          if (!applied.doc) {
            throw new UserError(409, "outdated", "Hemsidan har ändrats sedan förslaget gjordes, så det går inte att publicera längre. Be AI:n om ett nytt förslag.");
          }
          patches = applied.patches;
        }
        const { data: result, error } = await service.rpc("publish_ai_change", {
          p_message_id: message.id,
          p_marker: marker,
          p_patches: patches,
          p_cost: message.credit_cost,
          p_summary: stored.summary.slice(0, 480),
          p_actor: user.id,
        });
        if (error) throw error;
        if (result.status === "changed") continue;
        if (result.status === "insufficient_credits") throw new UserError(402, "insufficient_credits", "Du har inte tillräckligt med credits. Fyll på under Inställningar → Credits.");
        if (result.status !== "published") throw new UserError(409, "not_preview", "Förslaget kan inte publiceras längre.");
        const deploy = await triggerDeploy(result.version);
        await audit("ai.published", message.id, null, { version: result.version, cost: message.credit_cost }, user.id);
        const { data: row } = await service.from("ai_messages").select("*").eq("id", message.id).single();
        return json(request, { message: row, version: result.version, balance: result.balance, deploy });
      }
      throw new UserError(409, "busy", "Hemsidan ändrades precis samtidigt. Försök igen.");
    }

    // rollback
    const { data: result, error } = await service.rpc("rollback_ai_change", { p_message_id: message.id, p_actor: user.id });
    if (error) throw error;
    if (result.status === "not_latest") {
      throw new UserError(409, "not_latest", "Hemsidan har publicerats igen efter den här ändringen. Använd Versionshistorik under Inställningar för att gå tillbaka.");
    }
    if (result.status !== "rolled_back") throw new UserError(409, "not_published", "Ändringen går inte att ångra.");
    const deploy = await triggerDeploy(result.version);
    const { data: row } = await service.from("ai_messages").select("*").eq("id", message.id).single();
    return json(request, { message: row, version: result.version, balance: result.balance, deploy });
  })
);
