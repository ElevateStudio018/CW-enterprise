import { Icon } from "@/components/Icon";
import { JsonLd } from "./JsonLd";
import { HeroCrumbs } from "../sections/PageHeroSection";
import { ServiceTile } from "../sections/ServicesSection";
import { Gallery } from "../sections/GallerySection";
import { Reviews } from "../sections/TestimonialsSection";
import { Btn, CallBtn, Eyebrow, MoreLink, SecHead } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import { toE164 } from "@/lib/site/format.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import { QUOTE_HREF } from "@/lib/site/links.ts";
import type { Service, SiteData } from "@/lib/site/schema.ts";

/** The reviews shown on the service pages: those of the first reviews section on the site. */
function siteReviews(site: SiteData) {
  for (const page of list(site.pages)) {
    for (const section of list(page.sections)) {
      if (section.type === "testimonials" && !section.hidden) return list(section.items);
    }
  }
  return [];
}

/** A service's page, built from the service and the texts all service pages share. Also used by the admin preview. */
export function ServicePageView({ site, service }: { site: SiteData; service: Service }) {
  const { company, servicePage: texts, ui } = site;
  const others = list(site.services).filter((item) => item.slug !== service.slug);
  const gallery = list(service.gallery);
  const reviews = siteReviews(site);
  const quote = { label: texts.cta.button.label || site.navigation.menuButton, href: QUOTE_HREF };

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: service.name,
          name: `${service.name} – ${company.legalName}`,
          description: service.shortDescription,
          areaServed: company.serviceArea,
          provider: {
            "@type": "HomeAndConstructionBusiness",
            name: company.legalName,
            ...(company.phone ? { telephone: toE164(company.phone) } : {}),
            ...(company.email ? { email: company.email } : {}),
          },
        }}
      />

      <section className="hero">
        <div className="hero-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...imageProps(service.image, "100vw")} alt={service.image.alt} style={focusStyle(service.image)} fetchPriority="high" />
        </div>
        <div className="wrap hero-in">
          <HeroCrumbs
            label={ui.breadcrumbsLabel}
            items={[
              { label: ui.breadcrumbHome, href: "/" },
              { label: texts.breadcrumbLabel, href: texts.breadcrumbHref },
              { label: service.name },
            ]}
          />
          <Eyebrow text={texts.eyebrow} />
          <h1>{service.name}</h1>
          <p className="hero-lead">{service.shortDescription}</p>
          <div className="btns">
            <Btn link={quote} kind="blue" arrow />
            <CallBtn phone={company.phone} prefix={ui.callPrefix} />
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap svc-intro">
          <div className="svc-text">
            <Eyebrow text={texts.badge || service.name} />
            {service.lead && <h2>{service.lead}</h2>}
            {service.description.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <div className="btns">
              <Btn link={quote} kind="blue" arrow />
              <CallBtn phone={company.phone} prefix={ui.callPrefix} kind="ghost" />
            </div>
          </div>
          {service.includes.length > 0 && (
            <aside className="incl">
              <p className="incl-h">{texts.includesHeading}</p>
              <ul>
                {service.includes.map((item) => (
                  <li key={item}>
                    <Icon name="Check" className="ic" />
                    {item}
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="sec tint">
          <div className="wrap">
            <SecHead eyebrow={texts.galleryEyebrow} heading={service.galleryHeading} right={<MoreLink link={service.galleryLink} />} />
            <Gallery group={`svc-${service.slug}`} images={gallery} />
          </div>
        </section>
      )}

      {reviews.length > 0 && <Reviews eyebrow={texts.reviewsEyebrow} heading={texts.reviewsHeading} text="" reviews={reviews} site={site} tint={gallery.length === 0} />}

      {others.length > 0 && (
        <section className={`sec${gallery.length > 0 && reviews.length > 0 ? " tint" : ""}`}>
          <div className="wrap">
            <SecHead eyebrow={texts.moreEyebrow} heading={texts.moreHeading} />
            <ul className="tiles">
              {others.map((other) => (
                <ServiceTile key={other.id} service={other} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {texts.cta.heading && (
        <section className="cta">
          <div className="wrap cta-in">
            <div>
              <h2>{texts.cta.heading}</h2>
              {texts.cta.text && <p>{texts.cta.text}</p>}
            </div>
            <div className="btns">
              <Btn link={texts.cta.button} kind="light" arrow />
              <CallBtn phone={company.phone} kind="outline" />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
