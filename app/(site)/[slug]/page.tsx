import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageView } from "@/components/site/PageView";
import { getSite } from "@/lib/site/data.ts";
import { pageBySlug, subpages } from "@/lib/site/pages.ts";

// Only the pages in the content exist; anything else is the 404 page.
export const dynamicParams = false;

export function generateStaticParams() {
  return subpages(getSite()).map((page) => ({ slug: page.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = pageBySlug(getSite(), params.slug);
  if (!page) return {};
  return {
    title: page.seo.title,
    description: page.seo.description,
    alternates: { canonical: `/${page.slug}` },
  };
}

export default function ContentPage({ params }: { params: { slug: string } }) {
  const site = getSite();
  const page = pageBySlug(site, params.slug);
  if (!page) notFound();
  return <PageView page={page} site={site} isHome={false} />;
}
