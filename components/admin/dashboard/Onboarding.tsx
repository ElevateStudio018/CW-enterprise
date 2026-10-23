"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "../ui/Card";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { doneFromContent, itemForSave, loadOnboarding, onboardingItems, saveOnboarding, type OnboardingState } from "@/lib/admin/onboarding";
import { supabase } from "@/lib/admin/supabase";

/** "Kom igång": shown from the first login until every item is done, then never again. */
export function Onboarding() {
  const { draft, store } = useDraft();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [conversations, setConversations] = useState(0);

  useEffect(() => {
    void loadOnboarding().then(setState);
    void supabase()
      .from("ai_conversations")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setConversations(count ?? 0));
  }, []);

  // Saves tick items off as they happen.
  useEffect(
    () =>
      store.onSaved((entry) => {
        const item = itemForSave(entry, store.getState().draft);
        if (!item) return;
        setState((current) => {
          if (!current || current.done.includes(item)) return current;
          const next = { ...current, done: [...current.done, item] };
          void saveOnboarding(next);
          return next;
        });
      }),
    [store]
  );

  const done = useMemo(() => new Set([...(state?.done ?? []), ...doneFromContent(draft, conversations)]), [state, draft, conversations]);
  const allDone = onboardingItems.every((item) => done.has(item.id));

  useEffect(() => {
    if (state && allDone && !state.completed) {
      const next = { ...state, done: Array.from(done), completed: true };
      setState(next);
      void saveOnboarding(next);
    }
  }, [allDone, state, done]);

  if (!state || state.completed || allDone) return null;
  const count = onboardingItems.filter((item) => done.has(item.id)).length;

  const remaining = onboardingItems.filter((item) => !done.has(item.id));

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="text-[16px] font-semibold text-admin-ink">Kom igång</h2>
          <p className="mt-0.5 text-[13px] text-admin-muted">
            {count} av {onboardingItems.length} klara · listan försvinner när allt är gjort
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-admin/10 sm:w-48" aria-hidden="true">
          <div className="h-full rounded-full bg-admin transition-[width] duration-500" style={{ width: `${(count / onboardingItems.length) * 100}%` }} />
        </div>
      </div>
      {/* Only what is left; done items drop off the list. */}
      <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
        {remaining.map((item) => (
          <li key={item.id} className="border-t border-admin-line">
            <Link
              href={item.href}
              className="group flex min-h-12 items-center gap-3 rounded-lg py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
            >
              <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full ring-2 ring-inset ring-stone-300 transition group-hover:ring-admin/50" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-admin-ink">{item.label}</span>
                <span className="block text-[13px] text-admin-muted">{item.hint}</span>
              </span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-admin-subtle transition group-hover:translate-x-0.5 group-hover:text-admin-ink" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
