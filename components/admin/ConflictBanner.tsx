"use client";

import { AlertTriangle } from "lucide-react";
import { AdminButton } from "./ui/Button";
import { useDraft } from "@/contexts/admin/AdminDataContext";

function preview(value: unknown): string {
  if (value === null || value === undefined) return "(borttaget)";
  if (typeof value === "string") return value.length > 160 ? `${value.slice(0, 160)}…` : value || "(tomt)";
  return "(en annan version av den här delen)";
}

/** When the same field was changed on another device: shows both and lets the person choose. Nothing is lost meanwhile. */
export function ConflictBanner() {
  const { conflict, store } = useDraft();
  if (!conflict) return null;
  return (
    <div role="alert" className="admin-rise mb-6 rounded-2xl bg-amber-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950">Ändringen gjordes även på en annan enhet</p>
          <p className="mt-1 text-[14px] text-amber-900">Samma fält har ändrats någon annanstans sedan du öppnade det. Välj vilken version som ska gälla.</p>
          <dl className="mt-3 grid gap-3 text-[14px] sm:grid-cols-2">
            <div className="rounded-xl bg-white p-3">
              <dt className="text-[13px] font-semibold text-amber-800">Din version</dt>
              <dd className="mt-1 break-words text-admin-ink">{preview(conflict.mine)}</dd>
            </div>
            <div className="rounded-xl bg-white p-3">
              <dt className="text-[13px] font-semibold text-amber-800">Den andra versionen</dt>
              <dd className="mt-1 break-words text-admin-ink">{preview(conflict.theirs)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminButton variant="primary" size="sm" onClick={() => void store.resolveConflict("mine")}>
              Behåll min
            </AdminButton>
            <AdminButton variant="secondary" size="sm" onClick={() => void store.resolveConflict("theirs")}>
              Använd den andra
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}
