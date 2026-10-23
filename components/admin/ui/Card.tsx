import type { ReactNode } from "react";

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={`rounded-2xl bg-white p-5 ring-1 ring-admin-line sm:p-6 ${className}`}>{children}</Tag>;
}

export function CardHeader({ title, description, action, id }: { title: string; description?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[16px] font-semibold text-admin-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-[14px] leading-relaxed text-admin-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
