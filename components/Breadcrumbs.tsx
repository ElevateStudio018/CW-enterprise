import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[16px] text-muted">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex items-center gap-3">
            {index > 0 && <span aria-hidden="true">-</span>}
            {item.href ? (
              <Link href={item.href} className="relative transition-colors before:absolute before:-inset-x-1.5 before:-inset-y-3.5 hover:text-accent">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-body">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
