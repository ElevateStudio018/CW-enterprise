import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-admin-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-admin-muted sm:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
