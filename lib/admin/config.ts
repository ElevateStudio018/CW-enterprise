// Where the admin finds its Supabase project (see lib/connection.ts) and where the admin itself lives.
export { isConnected, supabaseAnonKey, supabaseUrl } from "@/lib/connection";

/** The base path the site is served under (on the GitHub Pages preview: /CW-enterprise). */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The admin's own address, for links that leave the app (password e-mails). */
export function adminUrl(path = ""): string {
  if (typeof window === "undefined") return `${basePath}/admin${path}`;
  return `${window.location.origin}${basePath}/admin${path}`;
}
