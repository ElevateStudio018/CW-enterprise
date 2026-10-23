"use client";

import Link from "next/link";
import { AlertTriangle, Check, CloudUpload, Coins } from "lucide-react";
import { useAdminData, useDraft } from "@/contexts/admin/AdminDataContext";

/** Save state and credit balance, always in view at the top right on computers; on phones only the save state fits. */
export function StatusBar({ compact = false }: { compact?: boolean }) {
  const { saveState } = useDraft();
  const { credits } = useAdminData();

  const save = {
    idle: { icon: Check, text: "Sparat", tone: "text-admin-muted" },
    saved: { icon: Check, text: "Sparat", tone: "text-emerald-700" },
    dirty: { icon: CloudUpload, text: "Sparar…", tone: "text-admin-muted" },
    saving: { icon: CloudUpload, text: "Sparar…", tone: "text-admin-muted" },
    error: { icon: AlertTriangle, text: "Ej sparat – försöker igen", tone: "text-amber-700" },
  }[saveState];
  const SaveIcon = save.icon;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <p aria-live="polite" className={`flex items-center gap-1.5 text-[13px] font-medium ${save.tone}`}>
        <SaveIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
        <span className={compact && saveState !== "error" ? "sr-only" : ""}>
          {save.text}
          {saveState === "idle" || saveState === "saved" ? " ✓" : ""}
        </span>
      </p>
      {!compact && (
        <Link
          href="/admin/installningar?flik=credits"
          className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-admin-ink transition hover:bg-stone-900/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
        >
          <Coins aria-hidden="true" className="h-4 w-4 text-admin" />
          {credits === null ? <span className="inline-block h-3 w-10 animate-pulse rounded bg-stone-200" /> : `${credits} credits`}
        </Link>
      )}
    </div>
  );
}
