import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicePageView } from "@/components/site/ServicePageView";
import { getSite } from "@/lib/site/data.ts";
import { list } from "@/lib/site/collection.ts";
import type { SiteData } from "@/lib/site/schema.ts";

export const dynamicParams = false;

function serviceBySlug(site: SiteData, slug: string) {
  return list(site.services).find((service) => service.slug === slug);
}

export function generateStaticParams() {
  return list(getSite().services).map((service) => ({ slug: service.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const site = getSite();
  const service = serviceBySlug(site, params.slug);
  if (!service) return {};

  const { title, description } = service.seo;
  return {
    title,
    description,
    alternates: { canonical: `/tjanster/${service.slug}` },
    openGraph: {
      title: `${title} | ${site.settings.siteName}`,
      description,
      url: `${site.settings.siteUrl}/tjanster/${service.slug}`,
      type: "website",
    },
  };
}

export default function ServicePage({ params }: { params: { slug: string } }) {
  const site = getSite();
  const service = serviceBySlug(site, params.slug);
  if (!service) notFound();
  return <ServicePageView site={site} service={service} />;
}
