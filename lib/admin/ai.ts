// The admin's side of Elevate AI: conversations and messages (read straight from the database, as row level security
// allows), and the ai-assistant function's actions, streamed where the function streams.
import type { Patch } from "@/lib/site/paths.ts";
import type { Plan, PriceLine } from "@/lib/site/changeset.ts";
import { supabase, callFunction, FunctionError } from "./supabase";
import { supabaseAnonKey, supabaseUrl } from "./config";

export interface AiConversation {
  id: string;
  title: string;
  updated_at: string;
}

export type AiStatus = "done" | "estimated" | "generating" | "preview" | "published" | "discarded" | "cancelled" | "failed" | "rolled_back";

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  attachments: { imageId: string; src: string; alt: string }[];
  plan: (Plan & { lines: PriceLine[]; total: number }) | null;
  change_set: {
    summary: string;
    imagesNeeded: string[];
    patches: Patch[];
    lines: PriceLine[];
    computedTotal: number;
    changes: string[];
  } | null;
  credit_cost: number;
  status: AiStatus;
  revision_id: number | null;
  created_at: string;
}

export type AiEvent =
  | { type: "start"; conversationId: string; message: AiMessage }
  | { type: "reply"; text: string }
  | { type: "status"; text: string }
  | { type: "progress"; chars: number }
  | { type: "done"; message: AiMessage }
  | { type: "error"; message: string };

export async function listConversations(): Promise<AiConversation[]> {
  const { data, error } = await supabase().from("ai_conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(60);
  if (error) throw error;
  return data as AiConversation[];
}

export async function listMessages(conversationId: string): Promise<AiMessage[]> {
  const { data, error } = await supabase().from("ai_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  if (error) throw error;
  return data as AiMessage[];
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const { error } = await supabase().from("ai_conversations").update({ title: title.slice(0, 120) }).eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase().from("ai_conversations").delete().eq("id", id);
  if (error) throw error;
}

/** A streamed action (send, approve): events arrive as they happen; aborting stops the work and charges nothing. */
export async function streamAi(body: Record<string, unknown>, onEvent: (event: AiEvent) => void, signal: AbortSignal): Promise<void> {
  const { data: session } = await supabase().auth.getSession();
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
      ...(session.session ? { Authorization: `Bearer ${session.session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("event-stream")) {
    const payload = await response.json().catch(() => null);
    throw new FunctionError(payload?.message ?? "Något gick fel. Försök igen.", payload?.error ?? "error", response.status, payload);
  }
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (chunk.startsWith("data: ")) onEvent(JSON.parse(chunk.slice(6)) as AiEvent);
    }
  }
}

export function aiAction<T>(action: "publish" | "discard" | "rollback", messageId: string): Promise<T> {
  return callFunction<T>("ai-assistant", { action, messageId });
}
