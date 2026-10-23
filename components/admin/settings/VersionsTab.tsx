"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, History, RotateCcw } from "lucide-react";
import { Card, CardHeader } from "../ui/Card";
import { AdminButton } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Dialog } from "../ui/Dialog";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton, SkeletonLines } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
import { PreviewPane } from "../editor/PreviewPane";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { callFunction, errorMessage, supabase } from "@/lib/admin/supabase";
import { formatDateTime } from "@/lib/admin/dates";
import { homePage } from "@/lib/site/pages.ts";
import type { SiteData } from "@/lib/site/schema.ts";

interface Revision {
  id: number;
  version: number;
  source: "baseline" | "manual" | "ai" | "restore" | "reset" | "backup";
  summary: string;
  created_at: string;
  created_by_email: string | null;
}

const sources: Record<Revision["source"], { label: string; tone: "neutral" | "prime" | "success" | "warning" }> = {
  baseline: { label: "Ursprunglig", tone: "neutral" },
  manual: { label: "Manuell", tone: "neutral" },
  ai: { label: "AI", tone: "prime" },
  restore: { label: "Återställning", tone: "success" },
  reset: { label: "Rensning", tone: "warning" },
  backup: { label: "Säkerhetskopia", tone: "neutral" },
};

/** The last 50 published versions: look at any of them, or publish one again as a new version. */
export function VersionsTab() {
  const toast = useToast();
  const { version: liveVersion, pendingChanges, themeChanged, store } = useDraft();
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [previewing, setPreviewing] = useState<{ revision: Revision; data: SiteData | null } | null>(null);
  const [restoring, setRestoring] = useState<Revision | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase().rpc("revision_list", { p_limit: 50 });
    if (error) toast.error(errorMessage(error, "Historiken kunde inte hämtas."));
    setRevisions((data as Revision[]) ?? []);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function preview(revision: Revision) {
    setPreviewing({ revision, data: null });
    const { data, error } = await supabase().from("content_revisions").select("snapshot").eq("id", revision.id).single();
    if (error) {
      toast.error(errorMessage(error, "Versionen kunde inte hämtas."));
      setPreviewing(null);
      return;
    }
    setPreviewing({ revision, data: data.snapshot as SiteData });
  }

  async function restore(revision: Revision) {
    setBusy(true);
    try {
      const { error } = await supabase().rpc("restore_revision", { p_revision_id: revision.id });
      if (error) throw error;
      // The restored version is published; the public site is rebuilt from it.
      const result = await callFunction<{ deploy: { started: boolean; message?: string } }>("publish", { action: "redeploy" }).catch(() => null);
      await store.load();
      toast.success(
        result?.deploy.started
          ? `Version ${revision.version} är återställd. Hemsidan uppdateras inom ett par minuter.`
          : `Version ${revision.version} är återställd och publicerad.`
      );
      setRestoring(null);
      setPreviewing(null);
      void load();
    } catch (error) {
      toast.error(errorMessage(error, "Versionen kunde inte återställas."));
    } finally {
      setBusy(false);
    }
  }

  const hasDraft = pendingChanges > 0 || themeChanged;

  return (
    <Card>
      <CardHeader
        title="Versionshistorik"
        description="Varje publicering sparas som en version. Återställer du en gammal version blir den en ny version – inget i historiken försvinner."
      />
      {revisions === null ? (
        <SkeletonLines lines={6} />
      ) : revisions.length === 0 ? (
        <EmptyState icon={History} title="Ingen historik än" text="Versionerna dyker upp här när du publicerar." />
      ) : (
        <ul className="divide-y divide-admin-line">
          {revisions.map((revision, index) => {
            const isLive = index === 0 && revision.version === liveVersion;
            return (
              <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-admin-ink">
                    Version {revision.version}
                    <Badge tone={sources[revision.source].tone}>{sources[revision.source].label}</Badge>
                    {isLive && <Badge tone="success">På hemsidan nu</Badge>}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[14px] text-admin-ink/80">{revision.summary || "–"}</p>
                  <p className="mt-0.5 text-[13px] text-admin-muted">
                    {formatDateTime(revision.created_at)}
                    {revision.created_by_email && <> · {revision.created_by_email}</>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <AdminButton size="sm" variant="ghost" icon={Eye} onClick={() => void preview(revision)}>
                    Förhandsgranska
                  </AdminButton>
                  {!isLive && (
                    <AdminButton size="sm" variant="ghost" icon={RotateCcw} onClick={() => setRestoring(revision)}>
                      Återställ
                    </AdminButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={previewing !== null}
        onClose={() => setPreviewing(null)}
        title={previewing ? `Version ${previewing.revision.version}` : ""}
        description={previewing ? `${sources[previewing.revision.source].label} · ${formatDateTime(previewing.revision.created_at)}` : undefined}
        size="xl"
        footer={
          previewing && !(previewing.revision.version === liveVersion && revisions?.[0]?.id === previewing.revision.id) ? (
            <AdminButton
              variant="primary"
              icon={RotateCcw}
              onClick={() => {
                setRestoring(previewing.revision);
                setPreviewing(null);
              }}
            >
              Återställ den här versionen
            </AdminButton>
          ) : undefined
        }
      >
        {previewing?.data ? (
          <PreviewPane draft={previewing.data} target={{ kind: "page", pageId: homePage(previewing.data).id }} className="h-[62svh]" />
        ) : (
          <Skeleton className="h-[62svh] w-full rounded-2xl" />
        )}
      </Dialog>

      <Dialog
        open={restoring !== null}
        onClose={() => setRestoring(null)}
        title={restoring ? `Återställa version ${restoring.version}?` : ""}
        size="sm"
        description={
          <>
            Hemsidan blir som den var i version {restoring?.version} och publiceras direkt som en ny version. Det kostar inga credits.
            {hasDraft && (
              <strong className="mt-2 block font-semibold text-amber-800">Dina opublicerade ändringar i utkastet försvinner.</strong>
            )}
          </>
        }
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setRestoring(null)} disabled={busy} data-autofocus>
              Avbryt
            </AdminButton>
            <AdminButton variant="primary" onClick={() => restoring && void restore(restoring)} busy={busy} busyLabel="Återställer…">
              Återställ
            </AdminButton>
          </>
        }
      />
    </Card>
  );
}
