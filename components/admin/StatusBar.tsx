"use client";

import { AlertTriangle, Check, CloudUpload } from "lucide-react";
import { useDraft } from "@/contexts/admin/AdminDataContext";

/** Save state, always in view at the top right (on phones as an icon only). */
export function StatusBar({ compact = false }: { compact?: boolean }) {
  const { saveState } = useDraft();

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
    </div>
  );
}
