import Link from "next/link";
import type { ReactNode } from "react";
import { QuoteTrigger } from "./QuoteTrigger";
import { isExternalHref, isQuoteHref } from "@/lib/site/links.ts";

/**
 * A link from the content: the quote form opens in its window, pages on the site go through Next's Link (which adds the
 * base path), parts of the current page and mail/phone addresses are plain links, and other sites open in a new tab.
 */
export function SiteLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (isQuoteHref(href)) return <QuoteTrigger className={className ?? ""}>{children}</QuoteTrigger>;
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
