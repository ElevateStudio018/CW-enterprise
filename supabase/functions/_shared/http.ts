import { config } from "./env.ts";

/** CORS headers for the calling origin, when it is one of the site's own. */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = config.allowedOrigins().includes(origin);
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-id",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(request: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request), ...extra },
  });
}

/** A failure the person can act on: a Swedish message for them and a code for the admin's own handling. */
export class UserError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/**
 * Wraps a handler: answers CORS preflights, turns UserErrors into their response and anything else into a friendly
 * Swedish message (logging the real error for the function logs).
 */
export function handle(handler: (request: Request) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof UserError) return json(request, { error: error.code, message: error.message }, error.status);
      console.error(error);
      return json(request, { error: "server_error", message: "Något gick fel hos oss. Försök igen om en stund." }, 500);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(request: Request, maxBytes = 2_000_000): Promise<T> {
  const text = await request.text();
  if (text.length > maxBytes) throw new UserError(413, "too_large", "Det du skickade var för stort.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UserError(400, "bad_request", "Ogiltig förfrågan.");
  }
}

/** The caller's address, as the platform's proxy reports it. */
export function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("cf-connecting-ip") || "okänd";
}
