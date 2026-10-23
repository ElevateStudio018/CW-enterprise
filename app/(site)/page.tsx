import { JsonLd } from "@/components/site/JsonLd";
import { PageView } from "@/components/site/PageView";
import { getSite } from "@/lib/site/data.ts";
import { homePage } from "@/lib/site/pages.ts";
import { toE164 } from "@/lib/site/format.ts";

export default function HomePage() {
  const site = getSite();
  const { company } = site;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HomeAndConstructionBusiness",
          name: company.legalName,
          url: site.settings.siteUrl,
          ...(company.phone ? { telephone: toE164(company.phone) } : {}),
          ...(company.email ? { email: company.email } : {}),
          ...(company.address.street
            ? {
                address: {
                  "@type": "PostalAddress",
                  streetAddress: company.address.street,
                  postalCode: company.address.postalCode,
                  addressLocality: company.address.city,
                  addressCountry: company.address.country,
                },
              }
            : {}),
          areaServed: company.serviceArea,
          ...(company.orgNumber ? { taxID: company.orgNumber } : {}),
          ...(company.vatNumber ? { vatID: company.vatNumber } : {}),
        }}
      />
      <PageView page={homePage(site)} site={site} isHome />
    </>
  );
}
