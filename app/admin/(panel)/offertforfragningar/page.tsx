"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArchiveRestore, Inbox, Mail, MailOpen, Phone, Search, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminButton } from "@/components/admin/ui/Button";
import { Badge } from "@/components/admin/ui/Badge";
import { Dialog } from "@/components/admin/ui/Dialog";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { useToast } from "@/components/admin/ui/Toast";
import { useAdminData } from "@/contexts/admin/AdminDataContext";
import { errorMessage, supabase } from "@/lib/admin/supabase";
import { formatDateTime, formatRelative } from "@/lib/admin/dates";

interface Quote {
  id: string;
  name: string;
  phone: string;
  email: string;
  work_type: string;
  message: string;
  status: "new" | "read";
  created_at: string;
  deleted_at: string | null;
}

type Filter = "all" | "new" | "read" | "trash";
const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Alla" },
  { id: "new", label: "Nya" },
  { id: "read", label: "Lästa" },
  { id: "trash", label: "Papperskorgen" },
];
const PAGE = 50;

/** The search as a filter on name, e-mail and phone: anywhere in the field, quoted so dots and @ are safe. */
function searchFilter(text: string): string | null {
  const words = text.replace(/["\\*%]/g, "").trim();
  if (!words) return null;
  return ["name", "email", "phone"].map((column) => `${column}.ilike."*${words}*"`).join(",");
}

function daysLeft(deletedAt: string): number {
  return Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000));
}

function QuoteDetail({
  quote,
  onStatus,
  onDelete,
  onRestore,
  onClose,
}: {
  quote: Quote;
  onStatus: (status: Quote["status"]) => void;
  onDelete: () => void;
  onRestore: () => void;
  onClose?: () => void;
}) {
  const subject = encodeURIComponent(`Ang. din offertförfrågan${quote.work_type ? ` – ${quote.work_type}` : ""}`);
  return (
    <article aria-labelledby="quote-title" className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="quote-title" className="break-words text-[22px] font-semibold leading-tight text-admin-ink">
            {quote.name}
          </h2>
          <p className="mt-1 text-[14px] text-admin-muted">
            {formatDateTime(quote.created_at)}
            {quote.work_type && <> · {quote.work_type}</>}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-admin-muted hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        )}
      </header>

      {quote.deleted_at && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          I papperskorgen. Raderas för gott om {daysLeft(quote.deleted_at)} dagar.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {quote.phone && (
          <a
            href={`tel:${quote.phone.replace(/[^\d+]/g, "")}`}
            className="flex min-h-12 items-center gap-3 rounded-xl bg-stone-50 px-4 text-[15px] font-semibold text-admin-ink ring-1 ring-admin-line hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
          >
            <Phone aria-hidden="true" className="h-4 w-4 text-admin" />
            {quote.phone}
          </a>
        )}
        {quote.email && (
          <a
            href={`mailto:${quote.email}?subject=${subject}`}
            className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl bg-stone-50 px-4 text-[15px] font-semibold text-admin-ink ring-1 ring-admin-line hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
          >
            <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-admin" />
            <span className="truncate">{quote.email}</span>
          </a>
        )}
      </div>

      <div>
        <h3 className="text-[13px] font-semibold text-admin-muted">Meddelande</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-admin-ink">
          {quote.message || <span className="text-admin-muted">Inget meddelande skrevs.</span>}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-admin-line pt-4">
        {quote.deleted_at ? (
          <AdminButton size="sm" icon={ArchiveRestore} onClick={onRestore}>
            Återställ
          </AdminButton>
        ) : (
          <>
            <AdminButton size="sm" icon={quote.status === "new" ? MailOpen : Mail} onClick={() => onStatus(quote.status === "new" ? "read" : "new")}>
              {quote.status === "new" ? "Markera som läst" : "Markera som oläst"}
            </AdminButton>
            <AdminButton size="sm" variant="ghost" icon={Trash2} onClick={onDelete} className="text-red-700 hover:bg-red-50">
              Ta bort
            </AdminButton>
          </>
        )}
      </div>
    </article>
  );
}

function QuoteRequests() {
  const toast = useToast();
  const { refreshQuotes, newQuotes } = useAdminData();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Quote | null>(null);
  const [wide, setWide] = useState(true);
  const requestId = useRef(0);
  const openId = params.get("id");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Searching waits until typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    let request = supabase().from("quote_requests").select("*", { count: "exact" });
    request = filter === "trash" ? request.not("deleted_at", "is", null) : request.is("deleted_at", null);
    if (filter === "new" || filter === "read") request = request.eq("status", filter);
    const or = searchFilter(query);
    if (or) request = request.or(or);
    const { data, count, error } = await request.order("created_at", { ascending: sort === "oldest" }).range(0, limit - 1);
    if (id !== requestId.current) return;
    if (error) {
      toast.error(errorMessage(error, "Förfrågningarna kunde inte hämtas."));
      setQuotes([]);
      return;
    }
    setQuotes(data as Quote[]);
    setTotal(count ?? 0);
  }, [filter, sort, query, limit, toast]);

  useEffect(() => {
    void load();
  }, [load, newQuotes]);

  // A link from the dashboard opens that request.
  useEffect(() => {
    if (!openId) return;
    void supabase()
      .from("quote_requests")
      .select("*")
      .eq("id", openId)
      .maybeSingle()
      .then(({ data }) => data && open(data as Quote));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  async function update(quote: Quote, changes: Partial<Pick<Quote, "status" | "deleted_at">>, quiet = false) {
    const next = { ...quote, ...changes };
    setQuotes((all) => all?.map((item) => (item.id === quote.id ? next : item)) ?? null);
    setSelected((current) => (current?.id === quote.id ? next : current));
    const { error } = await supabase().from("quote_requests").update(changes).eq("id", quote.id);
    if (error) {
      toast.error(errorMessage(error, "Ändringen kunde inte sparas."));
      void load();
      return false;
    }
    void refreshQuotes();
    if (!quiet) void load();
    return true;
  }

  function open(quote: Quote) {
    setSelected(quote);
    if (quote.status === "new" && !quote.deleted_at) void update(quote, { status: "read" }, true);
  }

  function close() {
    setSelected(null);
    if (openId) router.replace(pathname, { scroll: false });
  }

  async function remove(quote: Quote) {
    setConfirmDelete(null);
    const deletedAt = new Date().toISOString();
    if (await update(quote, { deleted_at: deletedAt })) {
      if (selected?.id === quote.id) setSelected(null);
      toast.success("Förfrågan ligger i papperskorgen i 30 dagar.", { label: "Ångra", onClick: () => void update({ ...quote, deleted_at: deletedAt }, { deleted_at: null }) });
    }
  }

  const detail = selected && (
    <QuoteDetail
      quote={selected}
      onStatus={(status) => void update(selected, { status }, true)}
      onDelete={() => setConfirmDelete(selected)}
      onRestore={() => {
        void update(selected, { deleted_at: null });
        toast.success("Förfrågan är återställd.");
      }}
      onClose={wide ? close : undefined}
    />
  );

  const emptyText = useMemo(() => {
    if (query) return { title: "Ingen förfrågan matchar sökningen", text: "Sök på namn, e-post eller telefonnummer." };
    if (filter === "trash") return { title: "Papperskorgen är tom", text: "Borttagna förfrågningar ligger här i 30 dagar innan de raderas för gott." };
    if (filter === "new") return { title: "Inga nya förfrågningar", text: "Allt är läst. Nya förfrågningar dyker upp här automatiskt." };
    if (filter === "read") return { title: "Inga lästa förfrågningar än", text: undefined };
    return { title: "Inga offertförfrågningar än", text: "De dyker upp här automatiskt när någon skickar formuläret på hemsidan, och du får ett mejl." };
  }, [filter, query]);

  return (
    <>
      <PageHeader title="Offertförfrågningar" description="Allt som skickas via offertformuläret på hemsidan. Du får också ett mejl för varje ny förfrågan." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Visa" className="flex flex-wrap gap-1 rounded-xl bg-stone-900/5 p-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => {
                setFilter(item.id);
                setLimit(PAGE);
                setSelected(null);
              }}
              className={`min-h-10 rounded-lg px-3.5 text-[14px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
                filter === item.id ? "bg-white text-admin-ink shadow-sm" : "text-admin-muted hover:text-admin-ink"
              }`}
            >
              {item.label}
              {item.id === "new" && newQuotes > 0 && <span className="ml-1.5 rounded-full bg-admin px-1.5 py-0.5 text-[11px] text-admin-contrast">{newQuotes}</span>}
            </button>
          ))}
        </div>
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Sök på namn, e-post eller telefon</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sök på namn, e-post eller telefon"
            className="min-h-11 w-full rounded-xl border-0 bg-white pl-10 pr-3 text-[16px] sm:text-[15px] text-admin-ink ring-1 ring-inset ring-admin-line focus:outline-none focus:ring-2 focus:ring-admin"
          />
        </label>
        <select
          aria-label="Sortering"
          value={sort}
          onChange={(event) => setSort(event.target.value as "newest" | "oldest")}
          className="min-h-11 rounded-xl border-0 bg-white px-3 text-[16px] sm:text-[15px] text-admin-ink ring-1 ring-inset ring-admin-line focus:outline-none focus:ring-2 focus:ring-admin"
        >
          <option value="newest">Nyast först</option>
          <option value="oldest">Äldst först</option>
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <div className="min-w-0 overflow-hidden rounded-2xl bg-white ring-1 ring-admin-line">
          {quotes === null ? (
            <ul className="divide-y divide-admin-line" role="status" aria-label="Laddar förfrågningar">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                  <Skeleton className="h-3.5 w-16" />
                </li>
              ))}
            </ul>
          ) : quotes.length === 0 ? (
            <EmptyState icon={Inbox} title={emptyText.title} text={emptyText.text} />
          ) : (
            <>
              <ul className="divide-y divide-admin-line">
                {quotes.map((quote) => {
                  const isNew = quote.status === "new" && !quote.deleted_at;
                  const active = selected?.id === quote.id;
                  return (
                    <li key={quote.id}>
                      <button
                        type="button"
                        onClick={() => open(quote)}
                        aria-current={active || undefined}
                        className={`flex w-full items-start gap-4 px-5 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-admin ${
                          active ? "bg-admin/[0.07]" : "hover:bg-stone-50"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${isNew ? "bg-admin" : "bg-transparent ring-1 ring-inset ring-stone-300"}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={`truncate text-[15px] ${isNew ? "font-bold text-admin-ink" : "font-semibold text-admin-ink"}`}>{quote.name}</span>
                            {isNew && <Badge tone="prime">Ny</Badge>}
                          </span>
                          <span className="mt-0.5 block truncate text-[14px] text-admin-muted">
                            {[quote.work_type, quote.message].filter(Boolean).join(" – ") || quote.phone || quote.email}
                          </span>
                        </span>
                        <span className="shrink-0 pt-0.5 text-[13px] tabular-nums text-admin-muted">
                          {quote.deleted_at ? `${daysLeft(quote.deleted_at)} dagar kvar` : formatRelative(quote.created_at)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {quotes.length < total && (
                <div className="border-t border-admin-line p-3 text-center">
                  <AdminButton variant="ghost" size="sm" onClick={() => setLimit(limit + PAGE)}>
                    Visa fler ({total - quotes.length} till)
                  </AdminButton>
                </div>
              )}
            </>
          )}
        </div>

        {wide && (
          <aside aria-label="Förfrågan" className="lg:sticky lg:top-[88px]">
            {detail ? (
              <div className="admin-fade rounded-2xl bg-white p-6 ring-1 ring-admin-line">{detail}</div>
            ) : (
              quotes &&
              quotes.length > 0 && (
                <div className="rounded-2xl border-2 border-dashed border-stone-300/80 px-6 py-12 text-center text-[14px] text-admin-muted">
                  Välj en förfrågan i listan för att läsa den.
                </div>
              )
            )}
          </aside>
        )}
      </div>

      {!wide && (
        <Dialog open={selected !== null} onClose={close} title="Offertförfrågan" size="md">
          {detail}
        </Dialog>
      )}

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Ta bort förfrågan?"
        description="Den flyttas till papperskorgen och raderas för gott efter 30 dagar. Tills dess kan du återställa den."
        size="sm"
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setConfirmDelete(null)} data-autofocus>
              Behåll
            </AdminButton>
            <AdminButton variant="danger" onClick={() => confirmDelete && void remove(confirmDelete)}>
              Ta bort
            </AdminButton>
          </>
        }
      />
    </>
  );
}

export default function QuoteRequestsPage() {
  return (
    <Suspense>
      <QuoteRequests />
    </Suspense>
  );
}
