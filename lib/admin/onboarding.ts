// The first-login checklist: five things that make the site the owner's own. Each ticks itself off when the content
// shows it is done or the relevant save happens; when all are done the list goes away for good.
import type { SiteData } from "@/lib/site/schema.ts";
import type { Entry } from "./draftStore";
import { supabase } from "./supabase";

export interface OnboardingState {
  done: string[];
  completed?: boolean;
}

export interface OnboardingItem {
  id: string;
  label: string;
  hint: string;
  href: string;
}

export const onboardingItems: OnboardingItem[] = [
  { id: "contact", label: "Lägg till kontaktuppgifter", hint: "Telefon, e-post och adress", href: "/admin/installningar?flik=foretag" },
  { id: "logo", label: "Ladda upp din logga", hint: "Visas i menyn och sidfoten", href: "/admin/installningar?flik=hemsida" },
  { id: "about", label: "Skriv om-oss-text", hint: "Berätta vilka ni är", href: "/admin/hemsidan?sida=om-oss" },
  { id: "colors", label: "Välj färger", hint: "Hemsidans färger och adminpanelens egen", href: "/admin/hemsidan?flik=farger" },
  { id: "ai", label: "Testa AI-assistenten", hint: "Be den om en ändring", href: "/admin/ai" },
];

/** Which items the content itself shows are done. */
export function doneFromContent(draft: SiteData | null, conversations: number): string[] {
  if (!draft) return [];
  const done: string[] = [];
  const { company } = draft;
  if (company.phone && company.email && company.address.street) done.push("contact");
  // The built-in wordmark is CW Enterprise's name set in the heading font (components/Wordmark.tsx), so the site has a logo either way.
  if (draft.settings.logo.kind === "image" || draft.settings.logo.kind === "wordmark") done.push("logo");
  if (conversations > 0) done.push("ai");
  return done;
}

/** Which item a save completes, if any. */
export function itemForSave(entry: Entry, draft: SiteData | null): string | null {
  if (entry.kind === "color" && entry.scope === "site") return "colors";
  if (entry.kind !== "patch" || !draft) return null;
  for (const patch of entry.patches) {
    const [root, , pageId, , , sectionId] = patch.path;
    if (root === "pages" && pageId === "om-oss") return "about";
    if (root === "pages" && sectionId) {
      const section = draft.pages.items[pageId]?.sections.items[sectionId];
      if (section?.type === "about" || section?.type === "aboutIntro") return "about";
    }
  }
  return null;
}

export async function loadOnboarding(): Promise<OnboardingState> {
  const { data } = await supabase().from("settings").select("value").eq("key", "onboarding").maybeSingle();
  return (data?.value as OnboardingState) ?? { done: [] };
}

export async function saveOnboarding(state: OnboardingState): Promise<void> {
  await supabase().rpc("save_setting", { p_key: "onboarding", p_value: state });
}
