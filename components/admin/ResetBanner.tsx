"use client";

import Link from "next/link";
import { Hourglass } from "lucide-react";
import { useAdminData } from "@/contexts/admin/AdminDataContext";

/** Shown on every page while a "Rensa alla ändringar" request waits for Elevate Studio. */
export function ResetBanner() {
  const { pendingReset } = useAdminData();
  if (!pendingReset) return null;
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 sm:px-5">
      <p className="flex items-center gap-2.5 text-[14px] text-amber-950">
        <Hourglass aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-700" />
        Din begäran om att rensa ändringar väntar på godkännande från Elevate Studio.
      </p>
      <Link
        href="/admin/installningar?flik=farozon"
        className="min-h-10 rounded-lg px-3 py-2 text-[14px] font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
      >
        Visa eller återkalla
      </Link>
    </div>
  );
}
