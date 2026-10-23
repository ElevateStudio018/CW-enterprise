"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Lightbulb, RotateCcw, Share2, Sparkles, Trash2 } from "lucide-react";
import { AdminButton, buttonClasses } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card, CardHeader } from "../ui/Card";
import { Dialog } from "../ui/Dialog";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
import { useAdminData } from "@/contexts/admin/AdminDataContext";
import { errorMessage } from "@/lib/admin/supabase";
import { formatRelative } from "@/lib/admin/dates";
import {
  deleteSuggestion,
  listSuggestions,
  setSuggestionStatus,
  suggestionPrompt,
  type Suggestion,
  type SuggestionFilter,
} from "@/lib/admin/suggestions";

const filters: { id: SuggestionFilter; label: string }[] = [
  { id: "open", label: "Att göra" },
  { id: "done", label: "Klara" },
  { id: "all", label: "Alla" },
];
const PAGE = 30;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** The address of the staff's page, on whatever domain the admin itself is opened on. */
function useSuggestionLink(): string {
  const [link, setLink] = useState("");
  useEffect(() => setLink(`${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/forslag/`), []);
  return link;
}

async function copyText(text: string, input: HTMLInputElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers: copy from the selected field instead.
    if (!input) return false;
    input.select();
    return document.execCommand("copy");
  }
}

function ShareCard() {
  const toast = useToast();
  const link = useSuggestionLink();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  async function copy() {
    if (await copyText(link, inputRef.current)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("Länken kunde inte kopieras. Markera den och kopiera för hand.");
    }
  }

  return (
    <Card>
      <CardHeader
        title="Länk till medarbetarna"
        description="Här skriver medarbetarna sitt namn och vad som kan bli bättre på hemsidan. Sidan finns inte i menyn och syns inte på Google. Du får ett mejl för varje nytt förslag."
      />
      <label htmlFor="suggestion-link" className="sr-only">
        Länken till förslagssidan
      </label>
      <input
        id="suggestion-link"
        ref={inputRef}
        readOnly
        value={link}
        onFocus={(event) => event.target.select()}
        className="min-h-11 w-full rounded-xl border-0 bg-stone-50 px-3.5 font-mono text-[16px] sm:text-[14px] text-admin-ink ring-1 ring-inset ring-admin-line focus:outline-none focus:ring-2 focus:ring-admin"
      />
      <div className="mt-2 grid gap-2">
        <AdminButton variant="primary" icon={copied ? Check : Copy} onClick={() => void copy()} disabled={!link}>
          {copied ? "Kopierad" : "Kopiera länken"}
        </AdminButton>
        <div className="flex gap-2">
          {canShare && (
            <AdminButton
              icon={Share2}
              onClick={() => void navigator.share({ title: "Förslag på förbättringar av hemsidan", url: link }).catch(() => undefined)}
              className="flex-1"
            >
              Dela
            </AdminButton>
          )}
          <a
            href={link || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-4 text-[15px] font-semibold text-admin-ink ring-1 ring-inset ring-admin-line transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin"
          >
            <ExternalLink aria-hidden="true" className="h-[18px] w-[18px]" />
            Öppna sidan
          </a>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Länken är kopierad." : ""}
      </p>
    </Card>
  );
}

function SuggestionCard({
  suggestion,
  fresh,
  onStatus,
  onDelete,
}: {
  suggestion: Suggestion;
  fresh: boolean;
  onStatus: (status: Suggestion["status"]) => void;
  onDelete: () => void;
}) {
  const done = suggestion.status === "done";
  return (
    <article
      aria-labelledby={`suggestion-${suggestion.id}`}
      className={`rounded-2xl bg-white p-5 ring-1 transition sm:p-6 ${fresh ? "ring-admin/40" : "ring-admin-line"}`}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${done ? "bg-stone-100 text-stone-500" : "bg-admin/10 text-admin"}`}
        >
          {initials(suggestion.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span id={`suggestion-${suggestion.id}`} className="break-words text-[16px] font-semibold text-admin-ink">
              {suggestion.name}
            </span>
            {fresh && <Badge tone="prime">Ny</Badge>}
            {done && (
              <Badge tone="success">
                <Check aria-hidden="true" className="h-3.5 w-3.5" /> Klar
              </Badge>
            )}
          </p>
          <p className="mt-0.5 text-[13px] text-admin-muted">
            {formatRelative(suggestion.created_at)}
            {suggestion.area && <> · Gäller: {suggestion.area}</>}
          </p>
        </div>
      </header>

      <p className={`mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed ${done ? "text-admin-muted" : "text-admin-ink"}`}>{suggestion.message}</p>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-admin-line pt-4">
        {!done && (
          <Link href={`/admin/ai?fraga=${encodeURIComponent(suggestionPrompt(suggestion))}`} className={buttonClasses("primary", "sm")}>
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Be AI:n göra det
          </Link>
        )}
        {done ? (
          <AdminButton size="sm" icon={RotateCcw} onClick={() => onStatus("read")}>
            Flytta tillbaka till att göra
          </AdminButton>
        ) : (
          <AdminButton size="sm" icon={Check} onClick={() => onStatus("done")}>
            Markera som klar
          </AdminButton>
        )}
        <AdminButton size="sm" variant="ghost" icon={Trash2} onClick={onDelete} className="text-red-700 hover:bg-red-50">
          Ta bort
        </AdminButton>
      </div>
    </article>
  );
}

/** Hemsidan → Förslag: what the staff think could be better, and the link to send them. */
export function SuggestionsTab() {
  const toast = useToast();
  const { newSuggestions, refreshSuggestions } = useAdminData();
  const [filter, setFilter] = useState<SuggestionFilter>("open");
  const [rows, setRows] = useState<Suggestion[] | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [removing, setRemoving] = useState<Suggestion | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const result = await listSuggestions(filter, limit);
      if (id !== requestId.current) return;
      // Seen now: still marked "Ny" on this visit, but no longer counted as new.
      const unseen = result.rows.filter((row) => row.status === "new").map((row) => row.id);
      setRows(result.rows.map((row) => (row.status === "new" ? { ...row, status: "read" } : row)));
      setTotal(result.total);
      if (unseen.length > 0) {
        setFresh((current) => new Set([...current, ...unseen]));
        await setSuggestionStatus(unseen, "read");
        void refreshSuggestions();
      }
    } catch (error) {
      if (id !== requestId.current) return;
      toast.error(errorMessage(error, "Förslagen kunde inte hämtas."));
      setRows((current) => current ?? []);
    }
  }, [filter, limit, refreshSuggestions, toast]);

  useEffect(() => {
    void load();
    // A new suggestion arriving (the counter goes up) shows at once.
  }, [load, newSuggestions]);

  async function changeStatus(suggestion: Suggestion, status: Suggestion["status"], undoable = true) {
    const previous = suggestion.status;
    // In "Att göra" and "Klara" the suggestion moves out of view; in "Alla" it stays and changes look.
    const leaves = (filter === "open" && status === "done") || (filter === "done" && status !== "done");
    setRows((current) => (leaves ? current?.filter((row) => row.id !== suggestion.id) : current?.map((row) => (row.id === suggestion.id ? { ...row, status } : row))) ?? null);
    if (leaves) setTotal((count) => Math.max(0, count - 1));
    try {
      await setSuggestionStatus([suggestion.id], status);
      if (!undoable) return void load();
      toast.success(status === "done" ? "Markerat som klart." : "Flyttat tillbaka till att göra.", {
        label: "Ångra",
        onClick: () => void changeStatus({ ...suggestion, status }, previous, false),
      });
    } catch (error) {
      toast.error(errorMessage(error, "Ändringen kunde inte sparas."));
      void load();
    }
  }

  async function remove(suggestion: Suggestion) {
    setRemoving(null);
    try {
      await deleteSuggestion(suggestion.id);
      setRows((current) => current?.filter((row) => row.id !== suggestion.id) ?? null);
      setTotal((count) => Math.max(0, count - 1));
      toast.success("Förslaget är borttaget.");
    } catch (error) {
      toast.error(errorMessage(error, "Förslaget kunde inte tas bort."));
    }
  }

  const empty =
    filter === "done"
      ? { title: "Inga klara förslag än", text: "När du markerar ett förslag som klart hamnar det här." }
      : filter === "open"
        ? { title: "Inga förslag att ta hand om", text: "Skicka länken till medarbetarna. Nya förslag dyker upp här, och du får ett mejl för varje nytt." }
        : { title: "Inga förslag än", text: "Skicka länken till medarbetarna. Nya förslag dyker upp här, och du får ett mejl för varje nytt." };

  return (
    <div className="grid max-w-[1200px] gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="lg:sticky lg:top-[88px] lg:order-2">
        <ShareCard />
      </div>

      <section aria-labelledby="suggestions-heading" className="min-w-0 space-y-4 lg:order-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="suggestions-heading" className="text-[18px] font-semibold text-admin-ink">
            Förslag från medarbetarna
          </h2>
          <div role="group" aria-label="Visa" className="flex flex-wrap gap-1 rounded-xl bg-stone-900/5 p-1">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => {
                  setFilter(item.id);
                  setLimit(PAGE);
                  setRows(null);
                }}
                className={`min-h-10 rounded-lg px-3.5 text-[14px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
                  filter === item.id ? "bg-white text-admin-ink shadow-sm" : "text-admin-muted hover:text-admin-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {rows === null ? (
          <div className="space-y-4" role="status" aria-label="Laddar förslag">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="rounded-2xl bg-white p-6 ring-1 ring-admin-line">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3.5 w-56" />
                  </div>
                </div>
                <Skeleton className="mt-5 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white ring-1 ring-admin-line">
            <EmptyState icon={Lightbulb} title={empty.title} text={empty.text} />
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {rows.map((suggestion) => (
                <li key={suggestion.id}>
                  <SuggestionCard
                    suggestion={suggestion}
                    fresh={fresh.has(suggestion.id)}
                    onStatus={(status) => void changeStatus(suggestion, status)}
                    onDelete={() => setRemoving(suggestion)}
                  />
                </li>
              ))}
            </ul>
            {rows.length < total && (
              <div className="text-center">
                <AdminButton variant="ghost" size="sm" onClick={() => setLimit(limit + PAGE)}>
                  Visa fler ({total - rows.length} till)
                </AdminButton>
              </div>
            )}
          </>
        )}
      </section>

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Ta bort förslaget?"
        description={removing ? `Förslaget från ${removing.name} tas bort för gott.` : undefined}
        size="sm"
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setRemoving(null)} data-autofocus>
              Behåll
            </AdminButton>
            <AdminButton variant="danger" onClick={() => removing && void remove(removing)}>
              Ta bort
            </AdminButton>
          </>
        }
      />
    </div>
  );
}
