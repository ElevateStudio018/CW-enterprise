import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { NotFoundView } from "@/components/site/NotFoundView";
import { getSite } from "@/lib/site/data.ts";

export function generateMetadata(): Metadata {
  return { title: getSite().notFound.seoTitle };
}

export default function NotFound() {
  const site = getSite();
  return (
    <SiteShell site={site}>
      <NotFoundView site={site} />
    </SiteShell>
  );
}
