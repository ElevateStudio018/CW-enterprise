import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isConnected, supabaseAnonKey, supabaseUrl } from "./config";

let client: SupabaseClient | null = null;

/** The admin's Supabase client: one per tab, keeping the session in this browser. */
export function supabase(): SupabaseClient {
  if (!isConnected) throw new Error("The admin is not connected to Supabase");
  client ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "cwe-admin" },
  });
  return client;
}

/** A Swedish message for a failure, for toasts and inline errors. */
export function errorMessage(error: unknown, fallback = "Något gick fel. Försök igen."): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    const message = (error as { message: string }).message;
    if (/failed to fetch|networkerror|load failed/i.test(message)) return "Ingen kontakt med servern. Kontrollera internetanslutningen.";
    if (/JWT|not signed in|invalid claim|session/i.test(message)) return "Din inloggning har gått ut. Logga in igen.";
    if (/[åäöÅÄÖ]/.test(message)) return message;
  }
  return fallback;
}

/** Calls one of the Edge Functions as the signed-in admin; their errors carry a Swedish message. */
export async function callFunction<T>(name: string, body?: unknown, method: "POST" | "GET" | "DELETE" = "POST"): Promise<T> {
  const { data: session } = await supabase().auth.getSession();
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      ...(session.session ? { Authorization: `Bearer ${session.session.access_token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new FunctionError(payload?.message ?? "Något gick fel. Försök igen.", payload?.error ?? "error", response.status, payload);
    throw error;
  }
  return payload as T;
}

export class FunctionError extends Error {
  constructor(message: string, public code: string, public status: number, public payload: unknown) {
    super(message);
  }
}
