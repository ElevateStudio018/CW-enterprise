import type { ReactNode } from "react";

const tones = {
  neutral: "bg-stone-100 text-stone-700",
  prime: "bg-admin/10 text-admin",
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-800",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${tones[tone]}`}>{children}</span>;
}
