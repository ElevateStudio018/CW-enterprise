"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Coins, Globe, Inbox, Lightbulb, PanelsTopLeft, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { PublishBar } from "@/components/admin/PublishBar";
import { Onboarding } from "@/components/admin/dashboard/Onboarding";
import { QuoteChart } from "@/components/admin/dashboard/QuoteChart";
import { Card, CardHeader } from "@/components/admin/ui/Card";
import { buttonClasses } from "@/components/admin/ui/Button";
import { Badge } from "@/components/admin/ui/Badge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Skeleton, SkeletonLines } from "@/components/admin/ui/Skeleton";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useAdminData, useDraft } from "@/contexts/admin/AdminDataContext";
import { supabase } from "@/lib/admin/supabase";
import { dayKey, formatRelative, lastDays } from "@/lib/admin/dates";

interface QuoteRow {
  id: string;
  name: string;
  work_type: string;
  status: "new" | "read";
  created_at: string;
}

interface Revision {
  created_at: string;
  summary: string;
  source: string;
}

function greeting(): string {
  const hour = Number(new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", timeZone: "Europe/Stockholm" }));
  return hour < 10 ? "God morgon" : hour < 18 ? "Välkommen tillbaka" : "God kväll";
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { status, publishedAt, pendingChanges, themeChanged } = useDraft();
  const { credits, newSuggestions } = useAdminData();
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [lastAi, setLastAi] = useState<Revision | null | undefined>(undefined);
  const [lastPublish, setLastPublish] = useState<Revision | null | undefined>(undefined);
  const [spentThisMonth, setSpentThisMonth] = useState<number | null>(null);

  useEffect(() => {
    const client = supabase();
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
    void client
      .from("quote_requests")
      .select("id, name, work_type, status, created_at")
      .is("deleted_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .then(({ data }) => setQuotes((data as QuoteRow[]) ?? []));
    void client
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .then(({ count }) => setTotal(count ?? 0));
    void client
      .from("content_revisions")
      .select("created_at, summary, source")
      .eq("source", "ai")
      .order("id", { ascending: false })
      .limit(1)
      .then(({ data }) => setLastAi((data?.[0] as Revision) ?? null));
    void client
      .from("content_revisions")
      .select("created_at, summary, source")
      .order("id", { ascending: false })
      .limit(1)
      .then(({ data }) => setLastPublish((data?.[0] as Revision) ?? null));
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    void client
      .from("credit_transactions")
      .select("amount")
      .eq("type", "spend")
      .gte("created_at", monthStart.toISOString())
      .then(({ data }) => setSpentThisMonth((data ?? []).reduce((sum, row: { amount: number }) => sum - row.amount, 0)));
  }, []);

  const perDay = useMemo(() => {
    if (!quotes) return null;
    const counts = new Map<string, number>();
    for (const quote of quotes) counts.set(dayKey(quote.created_at), (counts.get(dayKey(quote.created_at)) ?? 0) + 1);
    return lastDays(30).map((day) => ({ day, count: counts.get(day) ?? 0 }));
  }, [quotes]);

  const trend = useMemo(() => {
    if (!quotes) return null;
    const now = Date.now();
    const thisWeek = quotes.filter((q) => now - new Date(q.created_at).getTime() < 7 * 86_400_000).length;
    const lastWeek = quotes.filter((q) => {
      const age = now - new Date(q.created_at).getTime();
      return age >= 7 * 86_400_000 && age < 14 * 86_400_000;
    }).length;
    // Only compare when there is a previous period to compare with.
    const hasHistory = quotes.some((q) => now - new Date(q.created_at).getTime() >= 7 * 86_400_000);
    return { thisWeek, delta: thisWeek - lastWeek, hasHistory };
  }, [quotes]);

  const monthlyTotal = credits !== null && spentThisMonth !== null ? credits + spentThisMonth : null;
  const hasChartData = perDay ? perDay.some((day) => day.count > 0) : false;
  const name = profile?.fullName?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={name ? `${greeting()}, ${name}` : `${greeting()}!`}
        description="Så går det för hemsidan just nu."
        actions={
          <>
            <Link href="/admin/ai" className={buttonClasses("secondary")}>
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              Fråga AI:n
            </Link>
            <Link href="/admin/hemsidan" className={buttonClasses("primary")}>
              <PanelsTopLeft aria-hidden="true" className="h-4 w-4" />
              Redigera hemsidan
            </Link>
          </>
        }
      />

      <PublishBar />
      <Onboarding />

      {newSuggestions > 0 && (
        <Link
          href="/admin/hemsidan?flik=forslag"
          className="admin-rise mb-6 flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-admin-line transition hover:ring-admin/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin sm:px-5"
        >
          <Lightbulb aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-admin" />
          <span className="min-w-0 flex-1 text-[14px] text-admin-ink sm:text-[15px]">
            <strong className="font-semibold">{newSuggestions === 1 ? "Ett nytt förslag" : `${newSuggestions} nya förslag`}</strong> från medarbetarna
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-admin">
            Läs <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-3 lg:gap-6">
        <Card>
          <CardHeader
            title="Hemsidan"
            action={
              status === "ready" &&
              (pendingChanges > 0 || themeChanged ? <Badge tone="warning">Opublicerade ändringar</Badge> : <Badge tone="success">Publicerad</Badge>)
            }
          />
          {status !== "ready" || lastPublish === undefined ? (
            <SkeletonLines lines={3} />
          ) : (
            <>
              <dl className="space-y-3 text-[14px]">
                <div>
                  <dt className="text-admin-muted">Senast publicerad</dt>
                  <dd className="font-semibold text-admin-ink">{publishedAt ? formatRelative(publishedAt) : "–"}</dd>
                </div>
                <div>
                  <dt className="text-admin-muted">Senaste ändring</dt>
                  <dd className="line-clamp-2 text-admin-ink">{lastPublish?.summary ?? "–"}</dd>
                </div>
                <div>
                  <dt className="text-admin-muted">Senaste AI-ändring</dt>
                  <dd className="line-clamp-2 text-admin-ink">{lastAi ? `${lastAi.summary} · ${formatRelative(lastAi.created_at)}` : "Ingen än"}</dd>
                </div>
              </dl>
              <a
                href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-[14px] font-semibold text-admin hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
              >
                <Globe aria-hidden="true" className="h-4 w-4" /> Visa hemsidan <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Offertförfrågningar" />
          {total === null || !trend ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : (
            <>
              <p className="flex items-baseline gap-2">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.02em] text-admin-ink">{total}</span>
                <span className="text-[14px] text-admin-muted">totalt</span>
              </p>
              {trend.hasHistory ? (
                <p className={`mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold ${trend.delta >= 0 ? "text-emerald-700" : "text-admin-muted"}`}>
                  {trend.delta >= 0 ? <TrendingUp aria-hidden="true" className="h-4 w-4" /> : <TrendingDown aria-hidden="true" className="h-4 w-4" />}
                  {trend.delta > 0 ? `+${trend.delta}` : trend.delta} den här veckan jämfört med förra
                </p>
              ) : (
                <p className="mt-3 text-[13px] text-admin-muted">{trend.thisWeek} den här veckan</p>
              )}
              <Link
                href="/admin/offertforfragningar"
                className="mt-4 flex min-h-10 items-center gap-1.5 text-[14px] font-semibold text-admin hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
              >
                Visa alla <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Credits" />
          {credits === null || monthlyTotal === null ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-2 w-full" />
            </div>
          ) : (
            <>
              <p className="flex items-baseline gap-2">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.02em] text-admin-ink">{credits}</span>
                <span className="text-[14px] text-admin-muted">kvar</span>
              </p>
              <div className="mt-4">
                <div className="flex justify-between text-[13px] text-admin-muted">
                  <span>Använt i månaden</span>
                  <span className="font-semibold tabular-nums text-admin-ink">{spentThisMonth}</span>
                </div>
                {/* Meter: the used part in the prime colour on a lighter track of the same colour. */}
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-admin/10"
                  role="meter"
                  aria-label="Credits använda den här månaden"
                  aria-valuemin={0}
                  aria-valuemax={monthlyTotal}
                  aria-valuenow={spentThisMonth ?? 0}
                >
                  <div className={`h-full rounded-full ${credits <= 20 ? "bg-amber-600" : "bg-admin"}`} style={{ width: `${monthlyTotal > 0 ? ((spentThisMonth ?? 0) / monthlyTotal) * 100 : 0}%` }} />
                </div>
              </div>
              {credits <= 20 && (
                <p className="mt-3 text-[13px] text-amber-800">
                  {credits === 0 ? "Slut på credits – AI-assistenten är pausad tills du fyller på." : "Snart slut på credits."}
                </p>
              )}
              <Link href="/admin/installningar?flik=credits" className={buttonClasses("secondary", "sm", "mt-4")}>
                <Coins aria-hidden="true" className="h-4 w-4" /> Fyll på credits
              </Link>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Offertförfrågningar de senaste 30 dagarna" />
          {!perDay ? (
            <Skeleton className="h-56 w-full" />
          ) : hasChartData ? (
            <QuoteChart days={perDay} />
          ) : (
            <EmptyState icon={Inbox} title="Inga förfrågningar de senaste 30 dagarna" text="När någon skickar en offertförfrågan via hemsidan syns den här automatiskt." />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Senaste förfrågningarna"
            action={
              quotes && quotes.length > 0 ? (
                <Link href="/admin/offertforfragningar" className="text-[13px] font-semibold text-admin hover:underline">
                  Alla
                </Link>
              ) : undefined
            }
          />
          {!quotes ? (
            <SkeletonLines lines={5} />
          ) : quotes.length === 0 ? (
            <EmptyState icon={Inbox} title="Inga offertförfrågningar än" text="De dyker upp här automatiskt." />
          ) : (
            <ul className="-mx-2">
              {quotes.slice(0, 5).map((quote) => (
                <li key={quote.id}>
                  <Link
                    href={`/admin/offertforfragningar?id=${quote.id}`}
                    className="flex min-h-12 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${quote.status === "new" ? "bg-admin" : "bg-transparent"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[14px] ${quote.status === "new" ? "font-semibold text-admin-ink" : "text-admin-ink"}`}>
                        {quote.name}
                        {quote.status === "new" && <span className="sr-only"> (ny)</span>}
                      </span>
                      <span className="block truncate text-[13px] text-admin-muted">{quote.work_type || "Offertförfrågan"}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-admin-subtle">{formatRelative(quote.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
