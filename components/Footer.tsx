import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { SiteLink } from "./SiteLink";
import { CookieSettingsButton } from "./CookieSettingsButton";
import { list } from "@/lib/site/collection.ts";
import { toTelHref } from "@/lib/site/format.ts";
import type { SiteData } from "@/lib/site/schema.ts";

/** The dark footer: logo and a line about the company, the services, the other pages and how to get in touch. */
export function Footer({ site }: { site: SiteData }) {
  const { company, footer } = site;
  const certificates = list(site.certificates).slice(0, 4);
  const hours = company.openingHours
    .split(/[;\n]/)
    .map((row) => row.trim())
    .filter(Boolean);

  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link className="logo" href="/" aria-label={site.ui.homeLinkLabel}>
              <Wordmark content={{ logo: site.settings.logo, name: company.shortName }} onDark />
            </Link>
            {site.servicePage.contactTagline && <p>{site.servicePage.contactTagline}.</p>}
            {certificates.length > 0 && (
              <ul className="foot-certs">
                {certificates.map((cert) => (
                  <li key={cert.id}>{cert.name}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="foot-h">{footer.servicesHeading}</p>
            <ul>
              {list(site.services).map((service) => (
                <li key={service.id}>
                  <Link href={`/tjanster/${service.slug}`}>{service.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="foot-h">{footer.companyHeading}</p>
            <ul>
              {list(footer.companyLinks).map((link) => (
                <li key={link.id}>
                  <SiteLink href={link.href}>{link.label}</SiteLink>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="foot-h">{footer.contactHeading}</p>
            <ul>
              {company.phone && (
                <li>
                  <a href={toTelHref(company.phone)}>{company.phone}</a>
                </li>
              )}
              {company.email && (
                <li>
                  <a href={`mailto:${company.email}`}>{company.email}</a>
                </li>
              )}
              {hours.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="foot-end">
          <span>
            {`© ${new Date().getFullYear()} ${footer.copyrightName}`}
            {company.orgNumber && footer.orgLabel ? ` · ${footer.orgLabel} ${company.orgNumber}` : ""}
            {site.settings.analyticsId && site.ui.cookieSettings && (
              <>
                {" · "}
                <CookieSettingsButton label={site.ui.cookieSettings} />
              </>
            )}
          </span>
          <a href="https://elevatestudio.nu" target="_blank" rel="noopener">
            Byggd av Elevate Studio
          </a>
        </div>
      </div>
    </footer>
  );
}
