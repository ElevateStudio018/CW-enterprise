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
import { errorMessage } from "@/lib/admin/errors";
import { CONTENT_PATH, VERSION_PATH, commitFiles, contentHistory, readFile, type ContentCommit } from "@/lib/admin/github";
import { formatDateTime } from "@/lib/admin/dates";
import { homePage } from "@/lib/site/pages.ts";
import type { SiteData } from "@/lib/site/schema.ts";

interface Revision extends ContentCommit {
  label: string;
}

function labelFor(message: string): string {
  const match = message.match(/\(version (\d+)\)/);
  if (match) return `Version ${match[1]}`;
  if (/^Återställ/.test(message)) return "Återställning";
  return "Ändring";
}

/** The last 50 published versions (commits that changed content/site.json): look at any of them, or publish one again. */
export function VersionsTab() {
  const toast = useToast();
  const { pendingChanges, themeChanged, store } = useDraft();
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [previewing, setPreviewing] = useState<{ revision: Revision; data: SiteData | null } | null>(null);
  const [restoring, setRestoring] = useState<Revision | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const commits = await contentHistory(50);
      setRevisions(commits.map((c) => ({ ...c, label: labelFor(c.message) })));
    } catch (error) {
      toast.error(errorMessage(error, "Historiken kunde inte hämtas."));
      setRevisions([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function preview(revision: Revision) {
    setPreviewing({ revision, data: null });
    try {
      const file = await readFile(CONTENT_PATH, revision.sha);
      if (!file) throw new Error("Versionen finns inte längre.");
      setPreviewing({ revision, data: JSON.parse(file.text) as SiteData });
    } catch (error) {
      toast.error(errorMessage(error, "Versionen kunde inte hämtas."));
      setPreviewing(null);
    }
  }

  async function restore(revision: Revision) {
    setBusy(true);
    try {
      const file = await readFile(CONTENT_PATH, revision.sha);
      if (!file) throw new Error("Versionen finns inte längre.");
      const current = await readFile(VERSION_PATH);
      const version = ((current ? (JSON.parse(current.text) as { version?: number }).version : 0) ?? 0) + 1;
      await commitFiles(
        [
          { path: CONTENT_PATH, text: file.text },
          { path: VERSION_PATH, text: JSON.stringify({ version, publishedAt: new Date().toISOString() }, null, 2) + "\n" },
        ],
        `Återställ ${revision.label.toLowerCase()} från ${formatDateTime(revision.date)} (version ${version})`
      );
      await store.discard();
      toast.success(`${revision.label} är återställd. Hemsidan uppdateras inom ett par minuter.`);
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
            const isLive = index === 0;
            return (
              <li key={revision.sha} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-admin-ink">
                    {revision.label}
                    {isLive && <Badge tone="success">På hemsidan nu</Badge>}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[14px] text-admin-ink/80">{revision.message || "–"}</p>
                  <p className="mt-0.5 text-[13px] text-admin-muted">
                    {formatDateTime(revision.date)} · {revision.author}
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
        title={previewing ? previewing.revision.label : ""}
        description={previewing ? formatDateTime(previewing.revision.date) : undefined}
        size="xl"
        footer={
          previewing && revisions?.[0]?.sha !== previewing.revision.sha ? (
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
        title={restoring ? `Återställa ${restoring.label.toLowerCase()}?` : ""}
        size="sm"
        description={
          <>
            Hemsidan blir som den var {restoring ? formatDateTime(restoring.date) : ""} och publiceras direkt som en ny version.
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
