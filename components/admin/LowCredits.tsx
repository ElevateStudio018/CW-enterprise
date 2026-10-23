"use client";

import { useState } from "react";
import { Coins } from "lucide-react";
import { AdminButton } from "./ui/Button";
import { TopUpDialog } from "./settings/CreditsTab";
import { useAdminData } from "@/contexts/admin/AdminDataContext";
import { LOW_CREDITS } from "@/lib/site/pricing.ts";

/** A gentle note when credits run low (20 or fewer), firmer at 0; manual editing is never affected. */
export function LowCredits() {
  const { credits } = useAdminData();
  const [open, setOpen] = useState(false);
  if (credits === null || credits > LOW_CREDITS) return null;
  const empty = credits === 0;
  return (
    <div
      role="status"
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:px-5 ${empty ? "bg-red-50" : "bg-amber-50"}`}
    >
      <p className={`flex items-center gap-2.5 text-[14px] ${empty ? "text-red-950" : "text-amber-950"}`}>
        <Coins aria-hidden="true" className={`h-4 w-4 shrink-0 ${empty ? "text-red-700" : "text-amber-700"}`} />
        {empty
          ? "Slut på credits – AI-assistenten kan inte göra ändringar just nu. Allt du redigerar själv fungerar som vanligt."
          : `Bara ${credits} credits kvar. Fyll på i tid så att AI-assistenten kan fortsätta hjälpa dig.`}
      </p>
      <AdminButton size="sm" variant={empty ? "primary" : "secondary"} onClick={() => setOpen(true)}>
        Fyll på credits
      </AdminButton>
      <TopUpDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
