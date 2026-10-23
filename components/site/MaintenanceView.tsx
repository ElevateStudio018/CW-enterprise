import { Icon } from "@/components/Icon";
import { Wordmark } from "@/components/Wordmark";
import { buttonClasses } from "@/components/Button";
import { toTelHref } from "@/lib/site/format.ts";
import type { SiteData } from "@/lib/site/schema.ts";

/** Shown instead of every page while the owner has switched on maintenance mode: who they are and how to reach them. */
export function MaintenanceView({ site }: { site: SiteData }) {
  const { company, settings } = site;
  const { heading, text } = settings.maintenance;
  return (
    <main id="innehall" className="flex min-h-svh flex-col bg-page">
      <div className="bg-nav px-4 py-5 text-nav-text sm:px-6 lg:px-8">
        <div className="mx-auto max-w-content">
          <Wordmark content={{ logo: settings.logo, name: company.shortName }} />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-content flex-1 flex-col justify-center px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="max-w-3xl text-display text-heading lg:text-[56px] lg:leading-[1.08]">{heading}</h1>
        {text && <p className="mt-5 max-w-prose text-copy text-body lg:text-lead">{text}</p>}
        <div className="mt-9 flex flex-wrap gap-3">
          {company.phone && (
            <a href={toTelHref(company.phone)} className={buttonClasses("solid")}>
              <Icon name="Phone" strokeWidth={2.25} className="h-5 w-5" />
              {company.phone}
            </a>
          )}
          {company.email && (
            <a href={`mailto:${company.email}`} className={buttonClasses("outline", "normal-case")}>
              <Icon name="Mail" strokeWidth={2.25} className="h-5 w-5" />
              {company.email}
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
