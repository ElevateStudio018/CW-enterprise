const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** One-way hash, salted, for keeping addresses only as something to compare. */
export async function sha256(value: string, salt = ""): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(salt + value)));
}

export async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** Compares without leaking where two strings first differ. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export function randomToken(bytes = 32): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}
