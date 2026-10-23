import { supabase } from "./supabase";

/** An employee's suggestion for the website, sent from the unlisted /forslag page. */
export interface Suggestion {
  id: string;
  name: string;
  area: string;
  message: string;
  status: "new" | "read" | "done";
  created_at: string;
}

export type SuggestionFilter = "open" | "done" | "all";

export async function listSuggestions(filter: SuggestionFilter, limit: number): Promise<{ rows: Suggestion[]; total: number }> {
  let request = supabase().from("site_suggestions").select("id, name, area, message, status, created_at", { count: "exact" });
  if (filter === "open") request = request.in("status", ["new", "read"]);
  if (filter === "done") request = request.eq("status", "done");
  const { data, count, error } = await request.order("created_at", { ascending: false }).range(0, limit - 1);
  if (error) throw error;
  return { rows: (data as Suggestion[]) ?? [], total: count ?? 0 };
}

export async function countNewSuggestions(): Promise<number> {
  const { count } = await supabase().from("site_suggestions").select("id", { count: "exact", head: true }).eq("status", "new");
  return count ?? 0;
}

export async function setSuggestionStatus(ids: string[], status: Suggestion["status"]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase().from("site_suggestions").update({ status }).in("id", ids);
  if (error) throw error;
}

export async function deleteSuggestion(id: string): Promise<void> {
  const { error } = await supabase().from("site_suggestions").delete().eq("id", id);
  if (error) throw error;
}

/** What the AI assistant is asked when the admin wants a suggestion carried out. */
export function suggestionPrompt(suggestion: Pick<Suggestion, "name" | "area" | "message">): string {
  const about = suggestion.area ? ` (gäller: ${suggestion.area})` : "";
  return `${suggestion.name} har föreslagit en förbättring av hemsidan${about}:\n\n${suggestion.message.trim()}\n\nKan du göra den ändringen?`;
}
