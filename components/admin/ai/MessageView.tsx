"use client";

import Link from "next/link";
import { CheckCircle2, ChevronDown, CircleSlash, Eye, ImagePlus, RotateCcw, Sparkles, Undo2, UploadCloud } from "lucide-react";
import { AdminButton } from "../ui/Button";
import { RichText } from "./RichText";
import type { AiMessage } from "@/lib/admin/ai";

export interface Activity {
  messageId: string | null;
  kind: "send" | "approve";
  reply: string;
  status: string;
  chars: number;
}

function Credits({ value }: { value: number }) {
  return (
    <span className="tabular-nums">
      {value} {value === 1 ? "credit" : "credits"}
    </span>
  );
}

/** The row of a plan or change set's price: "Ny sektion: Teamet (20) + Justerad text: Toppen (1) = 21 credits". */
function Breakdown({ lines, total, cappedAt }: { lines: { label: string; credits: number }[]; total: number; cappedAt?: number }) {
  return (
    <div className="rounded-xl bg-stone-50 px-4 py-3">
      <ul className="space-y-1 text-[14px] text-admin-ink">
        {lines.map((line, index) => (
          <li key={index} className="flex justify-between gap-4">
            <span className="min-w-0">{line.label}</span>
            <span className="shrink-0 tabular-nums text-admin-muted">{line.credits}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between gap-4 border-t border-stone-200 pt-2 text-[14px] font-semibold text-admin-ink">
        <span>Kostnad</span>
        <Credits value={cappedAt !== undefined ? Math.min(total, cappedAt) : total} />
      </p>
      {cappedAt !== undefined && total > cappedAt && (
        <p className="mt-1 text-[12px] text-admin-muted">Du betalar aldrig mer än det pris du godkände.</p>
      )}
    </div>
  );
}

function Working({ text, chars, onStop }: { text: string; chars: number; onStop: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-admin/[0.05] px-4 py-3 ring-1 ring-admin/15" role="status">
      <span className="flex items-center gap-2.5 text-[14px] text-admin-ink">
        <span aria-hidden="true" className="flex gap-1">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="h-1.5 w-1.5 animate-pulse rounded-full bg-admin" style={{ animationDelay: `${dot * 180}ms` }} />
          ))}
        </span>
        {text}
        {chars > 0 && <span className="tabular-nums text-admin-muted">({Math.round(chars / 100) / 10}k tecken)</span>}
      </span>
      <AdminButton size="sm" variant="ghost" icon={CircleSlash} onClick={onStop}>
        Stoppa
      </AdminButton>
    </div>
  );
}

export function MessageView({
  message,
  activity,
  credits,
  hasDraftChanges,
  busy,
  previewing,
  onApprove,
  onDiscard,
  onPublish,
  onRollback,
  onPreview,
  onStop,
  onTopUp,
}: {
  message: AiMessage;
  activity: Activity | null;
  credits: number | null;
  hasDraftChanges: boolean;
  busy: string | null;
  previewing: boolean;
  onApprove: () => void;
  onDiscard: () => void;
  onPublish: () => void;
  onRollback: () => void;
  onPreview: () => void;
  onStop: () => void;
  onTopUp: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-2">
          {message.attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {message.attachments.map((attachment) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={attachment.imageId} src={attachment.src} alt={attachment.alt} className="h-20 w-20 rounded-xl object-cover ring-1 ring-admin-line" />
              ))}
            </div>
          )}
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-admin px-4 py-3 text-[15px] leading-relaxed text-admin-contrast">{message.content}</div>
        </div>
      </div>
    );
  }

  const generating = activity?.kind === "approve" && activity.messageId === message.id;
  const plan = message.plan;
  const changeSet = message.change_set;
  const short = credits !== null && credits < message.credit_cost;

  return (
    <div className="flex gap-3">
      <span aria-hidden="true" className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-admin/10 text-admin">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <RichText text={changeSet && message.status !== "estimated" ? changeSet.summary : message.content} className="text-admin-ink" />

        {message.status === "estimated" && plan && !generating && (
          <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-admin/20">
            <p className="text-[14px] font-semibold text-admin-ink">{plan.summary || "Föreslagen ändring"}</p>
            <Breakdown lines={plan.lines} total={plan.total} />
            {short && (
              <p className="text-[14px] text-red-800">
                Du har {credits} credits, och ändringen kostar {message.credit_cost}.{" "}
                <button type="button" onClick={onTopUp} className="font-semibold underline underline-offset-2">
                  Fyll på credits
                </button>
              </p>
            )}
            <p className="text-[13px] text-admin-muted">Inget dras förrän du har sett resultatet och väljer att publicera.</p>
            <div className="flex flex-wrap gap-2">
              <AdminButton variant="primary" size="sm" icon={Sparkles} onClick={onApprove} disabled={short || Boolean(activity)}>
                Godkänn och gör ändringen
              </AdminButton>
              <AdminButton variant="ghost" size="sm" onClick={onDiscard} disabled={busy !== null || Boolean(activity)}>
                Avbryt
              </AdminButton>
            </div>
          </div>
        )}

        {generating && activity && <Working text={activity.status || "Gör ändringen…"} chars={activity.chars} onStop={onStop} />}

        {message.status === "preview" && changeSet && (
          <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-admin/20">
            {changeSet.changes.length > 0 && (
              // The exact fields are there for whoever wants them; the price lines and the preview say it plainer.
              <details className="group">
                <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg text-[13px] font-semibold text-admin-muted hover:text-admin-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin [&::-webkit-details-marker]:hidden">
                  Exakt vad som ändras ({changeSet.changes.length})
                  <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-1 space-y-0.5 text-[13px] text-admin-ink">
                  {changeSet.changes.slice(0, 12).map((change) => (
                    <li key={change} className="truncate">
                      • {change}
                    </li>
                  ))}
                  {changeSet.changes.length > 12 && <li className="text-admin-muted">och {changeSet.changes.length - 12} till</li>}
                </ul>
              </details>
            )}
            {changeSet.imagesNeeded.length > 0 && (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-amber-950">
                <p className="flex items-center gap-2 font-semibold">
                  <ImagePlus aria-hidden="true" className="h-4 w-4" /> Bilder som skulle göra det bättre
                </p>
                <ul className="mt-1 space-y-0.5">
                  {changeSet.imagesNeeded.map((note) => (
                    <li key={note}>• {note}</li>
                  ))}
                </ul>
                <Link href="/admin/bilder" className="mt-1 inline-block font-semibold underline underline-offset-2">
                  Ladda upp under Bilder
                </Link>
              </div>
            )}
            <Breakdown lines={changeSet.lines} total={changeSet.computedTotal} cappedAt={plan?.total} />
            {hasDraftChanges && (
              <p className="text-[13px] text-admin-muted">Dina egna opublicerade ändringar publiceras samtidigt, precis som i förhandsvisningen.</p>
            )}
            <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
              <AdminButton variant="primary" size="sm" icon={UploadCloud} onClick={onPublish} busy={busy === `publish:${message.id}`} busyLabel="Publicerar…" disabled={busy !== null} className="mr-1">
                Publicera ({message.credit_cost} credits)
              </AdminButton>
              <AdminButton
                variant="ghost"
                size="sm"
                icon={Eye}
                onClick={onPreview}
                aria-pressed={previewing}
                title={previewing ? "Visas i förhandsvisningen" : undefined}
                className={previewing ? "bg-admin/[0.08] text-admin" : "text-admin-muted"}
              >
                Förhandsvisa
              </AdminButton>
              <AdminButton variant="ghost" size="sm" icon={Undo2} onClick={onDiscard} disabled={busy !== null} className="text-admin-muted">
                Ångra
              </AdminButton>
            </div>
          </div>
        )}

        {message.status === "published" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-emerald-900">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Publicerad · {message.credit_cost} credits
            </p>
            <AdminButton size="sm" variant="ghost" icon={RotateCcw} onClick={onRollback} busy={busy === `rollback:${message.id}`} busyLabel="Ångrar…" disabled={busy !== null}>
              Ångra ändringen
            </AdminButton>
          </div>
        )}

        {message.status === "rolled_back" && <p className="text-[13px] text-admin-muted">Ångrad efter publicering – credits återbetalda.</p>}
        {message.status === "discarded" && <p className="text-[13px] text-admin-muted">Ångrad – inget ändrades och inga credits drogs.</p>}
        {message.status === "generating" && !generating && <p className="text-[13px] text-admin-muted">Avbröts innan den var klar. Inga credits drogs.</p>}
      </div>
    </div>
  );
}
