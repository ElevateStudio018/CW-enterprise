import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-admin-muted">
        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <p className="mt-3 text-[15px] font-semibold text-admin-ink">{title}</p>
      {text && <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-admin-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
