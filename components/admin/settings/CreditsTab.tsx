"use client";

import { useEffect, useState } from "react";
import { Coins, Plus, TriangleAlert } from "lucide-react";
import { Card, CardHeader } from "../ui/Card";
import { AdminButton } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Dialog } from "../ui/Dialog";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton, SkeletonLines } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
import { useAdminData } from "@/contexts/admin/AdminDataContext";
import { callFunction, errorMessage, supabase } from "@/lib/admin/supabase";
import { formatDate, formatDateTime } from "@/lib/admin/dates";
import { LOW_CREDITS, priceTable } from "@/lib/site/pricing.ts";

interface Pack {
  credits: number;
  price: number | null;
}

interface Transaction {
  id: number;
  amount: number;
  type: "grant" | "spend" | "refund" | "topup" | "adjustment";
  description: string;
  balance_after: number;
  created_at: string;
}

interface Order {
  id: string;
  credits: number;
  price: number;
  status: "completed" | "pending_approval" | "rejected";
  invoiced: boolean;
  created_at: string;
}

const typeLabels: Record<Transaction["type"], string> = {
  grant: "Ingår",
  spend: "AI-ändring",
  refund: "Återbetalt",
  topup: "Påfyllning",
  adjustment: "Justering",
};

function price(value: number | null): string {
  return value === null || value === 0 ? "Enligt avtal" : `${value.toLocaleString("sv-SE")} kr`;
}

/** Choosing a pack, then a clear confirmation that it goes on the annual invoice. Used here and from the dashboard. */
export function TopUpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { refreshCredits } = useAdminData();
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [chosen, setChosen] = useState<Pack | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChosen(null);
    void supabase()
      .from("settings")
      .select("value")
      .eq("key", "credit_packs")
      .maybeSingle()
      .then(({ data }) => setPacks((data?.value as Pack[]) ?? []));
  }, [open]);

  async function order() {
    if (!chosen) return;
    setBusy(true);
    try {
      const result = await callFunction<{ status: string; balance: number }>("credits-topup", { credits: chosen.credits });
      await refreshCredits();
      if (result.status === "pending_approval") {
        toast.info("Beställningen är mottagen. Eftersom du beställt flera gånger i dag godkänner Elevate Studio den först.");
      } else {
        toast.success(`${chosen.credits} credits är tillagda. Nytt saldo: ${result.balance} credits.`);
      }
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Beställningen gick inte igenom. Försök igen."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={chosen ? "Bekräfta beställningen" : "Fyll på credits"}
      description={chosen ? undefined : "Credits läggs till direkt. Inget betalas här – beloppet läggs på er årsfaktura."}
      size="md"
      footer={
        chosen ? (
          <>
            <AdminButton variant="secondary" onClick={() => setChosen(null)} disabled={busy}>
              Tillbaka
            </AdminButton>
            <AdminButton variant="primary" onClick={() => void order()} busy={busy} busyLabel="Beställer…">
              Beställ {chosen.credits} credits
            </AdminButton>
          </>
        ) : undefined
      }
    >
      {chosen ? (
        <div className="space-y-4">
          <dl className="divide-y divide-admin-line rounded-xl bg-stone-50 ring-1 ring-admin-line">
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-admin-muted">Paket</dt>
              <dd className="font-semibold text-admin-ink">{chosen.credits} credits</dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-admin-muted">Pris</dt>
              <dd className="font-semibold text-admin-ink">{price(chosen.price)}</dd>
            </div>
          </dl>
          <p className="rounded-xl bg-admin/[0.06] px-4 py-3 text-[15px] leading-relaxed text-admin-ink ring-1 ring-admin/20">
            <strong className="font-semibold">Beloppet läggs på er årsfaktura.</strong> Ingen betalning sker nu. Du och Elevate Studio får en bekräftelse
            på mejlen.
          </p>
        </div>
      ) : packs === null ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {packs.map((pack) => (
            <li key={pack.credits}>
              <button
                type="button"
                onClick={() => setChosen(pack)}
                className="flex h-full min-h-24 w-full flex-col justify-center rounded-xl bg-white px-4 py-4 text-left ring-1 ring-admin-line transition hover:bg-stone-50 hover:ring-admin/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
              >
                <span className="text-[24px] font-semibold tabular-nums text-admin-ink">{pack.credits}</span>
                <span className="text-[13px] text-admin-muted">credits · {price(pack.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/** The table of what AI changes cost, exactly as agreed. */
export function PriceTable() {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-admin-line">
      <table className="w-full text-left text-[14px]">
        <thead className="bg-stone-50 text-[13px] text-admin-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Åtgärd
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">
              Credits
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-line">
          {priceTable.map((row) => (
            <tr key={row.action}>
              <td className="px-4 py-2.5 text-admin-ink">{row.action}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-admin-ink">{row.credits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CreditsTab() {
  const { credits } = useAdminData();
  const [topUp, setTopUp] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    void supabase()
      .from("credit_transactions")
      .select("id, amount, type, description, balance_after, created_at")
      .order("id", { ascending: false })
      .limit(limit)
      .then(({ data }) => setTransactions((data as Transaction[]) ?? []));
  }, [limit, credits]);

  useEffect(() => {
    void supabase()
      .from("credit_orders")
      .select("id, credits, price, status, invoiced, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setOrders((data as Order[]) ?? []));
  }, [credits]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-admin-muted">Saldo</p>
            {credits === null ? (
              <Skeleton className="mt-2 h-10 w-32" />
            ) : (
              <p className="mt-1 text-[40px] font-semibold leading-none tracking-[-0.02em] text-admin-ink">
                {credits} <span className="text-[18px] font-medium text-admin-muted">credits</span>
              </p>
            )}
          </div>
          <AdminButton variant="primary" icon={Plus} onClick={() => setTopUp(true)}>
            Fyll på credits
          </AdminButton>
        </div>
        {credits !== null && credits <= LOW_CREDITS && (
          <p className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-[14px] ring-1 ${credits === 0 ? "bg-red-50 text-red-900 ring-red-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {credits === 0
              ? "Slut på credits. AI-assistenten kan inte göra ändringar förrän du fyller på – att redigera själv fungerar som vanligt."
              : "Det börjar ta slut på credits. Fyll på i tid, så att AI-assistenten kan fortsätta hjälpa dig."}
          </p>
        )}
        <p className="mt-4 text-[14px] leading-relaxed text-admin-muted">
          Credits används bara när AI-assistenten gör en ändring som du har godkänt. Allt du ändrar själv i adminpanelen är alltid gratis.
        </p>
      </Card>

      <Card>
        <CardHeader title="Så fungerar credits" description="Kostnaden räknas ut innan något görs, och dras först när du godkänner ändringen." />
        <PriceTable />
      </Card>

      <Card>
        <CardHeader title="Historik" />
        {transactions === null ? (
          <SkeletonLines lines={5} />
        ) : transactions.length === 0 ? (
          <EmptyState icon={Coins} title="Inga händelser än" />
        ) : (
          <>
            <ul className="divide-y divide-admin-line">
              {transactions.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-admin-ink">{row.description}</p>
                    <p className="text-[13px] text-admin-muted">
                      {typeLabels[row.type]} · {formatDateTime(row.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[15px] font-semibold tabular-nums ${row.amount < 0 ? "text-admin-ink" : "text-emerald-700"}`}>
                      {row.amount > 0 ? `+${row.amount}` : row.amount}
                    </p>
                    <p className="text-[12px] tabular-nums text-admin-muted">saldo {row.balance_after}</p>
                  </div>
                </li>
              ))}
            </ul>
            {transactions.length === limit && (
              <AdminButton variant="ghost" size="sm" className="mt-2" onClick={() => setLimit(limit + 25)}>
                Visa fler
              </AdminButton>
            )}
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="Beställningar" description="Påfyllningar läggs på årsfakturan." />
        {orders === null ? (
          <SkeletonLines lines={3} />
        ) : orders.length === 0 ? (
          <p className="text-[14px] text-admin-muted">Inga beställningar än.</p>
        ) : (
          <ul className="divide-y divide-admin-line">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-[14px] font-semibold text-admin-ink">{order.credits} credits</p>
                  <p className="text-[13px] text-admin-muted">
                    {formatDate(order.created_at, true)} · {price(order.price)}
                  </p>
                </div>
                {order.status === "pending_approval" ? (
                  <Badge tone="warning">Väntar på godkännande</Badge>
                ) : order.status === "rejected" ? (
                  <Badge tone="danger">Nekad</Badge>
                ) : order.invoiced ? (
                  <Badge tone="success">Fakturerad</Badge>
                ) : (
                  <Badge tone="prime">Kommer på årsfakturan</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <TopUpDialog open={topUp} onClose={() => setTopUp(false)} />
    </div>
  );
}
