"use client";

import { useState } from "react";
import { CheckCircle2, CloudUpload, RotateCcw, TriangleAlert } from "lucide-react";
import { AdminButton } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { useToast } from "./ui/Toast";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { useDeployStatus } from "@/lib/admin/deploy";
import { errorMessage } from "@/lib/admin/supabase";

/**
 * Unpublished changes and the Publicera button, then how the public site is catching up. Shown in the editor and on the
 * dashboard; quiet when there is nothing to publish and the site is live.
 */
export function PublishBar() {
  const { pendingChanges, themeChanged, publishing, publishIssues, version, store, status } = useDraft();
  const toast = useToast();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [lastPublished, setLastPublished] = useState<number>(0);
  const deploy = useDeployStatus(lastPublished);
  const hasChanges = pendingChanges > 0 || themeChanged;

  if (status !== "ready") return null;

  async function publish() {
    try {
      const result = await store.publish();
      setLastPublished(result.version);
      if (result.deploy.started) toast.success("Publicerat! Hemsidan uppdateras inom ett par minuter.");
      else toast.info(result.deploy.message ?? "Publicerat.");
    } catch (error) {
      toast.error(errorMessage(error, "Det gick inte att publicera. Försök igen."));
    }
  }

  async function discard() {
    setConfirmDiscard(false);
    try {
      await store.discard();
      toast.success("Ändringarna är borttagna. Utkastet är som den publicerade sidan.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const deployLine =
    lastPublished > 0
      ? {
          live: { icon: CheckCircle2, text: "Hemsidan är uppdaterad ✓", tone: "text-emerald-800 bg-emerald-50" },
          updating: { icon: CloudUpload, text: "Hemsidan uppdateras – det tar ett par minuter…", tone: "text-admin-ink bg-admin/10" },
          idle: { icon: CloudUpload, text: "Hemsidan uppdateras – det tar ett par minuter…", tone: "text-admin-ink bg-admin/10" },
          failed: { icon: TriangleAlert, text: "Ändringen är sparad, men uppdateringen av hemsidan misslyckades.", tone: "text-amber-900 bg-amber-50" },
          not_configured: { icon: TriangleAlert, text: "Publicerat. Den automatiska uppdateringen av hemsidan är inte kopplad än.", tone: "text-amber-900 bg-amber-50" },
        }[deploy.phase]
      : null;

  if (!hasChanges && !deployLine && publishIssues.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {hasChanges && (
        <div className="admin-rise flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-admin/25 sm:px-5">
          <p className="flex items-center gap-2.5 text-[15px] text-admin-ink">
            <CloudUpload aria-hidden="true" className="h-5 w-5 text-admin" />
            <span>
              <strong className="font-semibold">Opublicerade ändringar</strong>
              <span className="text-admin-muted"> – sparade, men syns inte på hemsidan förrän du publicerar.</span>
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="ghost" size="sm" icon={RotateCcw} onClick={() => setConfirmDiscard(true)} disabled={publishing}>
              Släng ändringar
            </AdminButton>
            <AdminButton variant="primary" size="sm" icon={CloudUpload} onClick={() => void publish()} busy={publishing} busyLabel="Publicerar…">
              Publicera
            </AdminButton>
          </div>
        </div>
      )}

      {publishIssues.length > 0 && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 sm:px-5">
          <p className="font-semibold text-red-900">Rätta det här innan du publicerar:</p>
          <ul className="mt-2 space-y-1 text-[14px] text-red-900">
            {publishIssues.map((issue) => (
              <li key={issue.path.join(".")}>
                <strong className="font-semibold">{issue.where}:</strong> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {deployLine && !hasChanges && (
        <p aria-live="polite" className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold ${deployLine.tone}`}>
          {deploy.phase === "updating" || deploy.phase === "idle" ? (
            <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-admin" />
          ) : (
            <deployLine.icon aria-hidden="true" className="h-4 w-4" />
          )}
          {deployLine.text} <span className="font-normal text-admin-muted">(version {version})</span>
        </p>
      )}

      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Släng alla opublicerade ändringar?"
        description="Utkastet blir som den publicerade hemsidan. Det går inte att ångra."
        size="sm"
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setConfirmDiscard(false)} data-autofocus>
              Avbryt
            </AdminButton>
            <AdminButton variant="danger" onClick={() => void discard()}>
              Släng ändringarna
            </AdminButton>
          </>
        }
      />
    </div>
  );
}
