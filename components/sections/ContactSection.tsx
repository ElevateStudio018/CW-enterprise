import { Icon, type IconKey } from "../Icon";
import { QuoteForm } from "../QuoteForm";
import { Eyebrow } from "../vk/parts";
import { quoteFormContent } from "../site/quoteFormContent";
import { fullAddress, toTelHref } from "@/lib/site/format.ts";
import type { SectionProps } from "./types";

interface ContactRow {
  icon: IconKey;
  label: string;
  value: string;
  href?: string;
}

/** How to reach the company on the left, the quote form in a box on the right. */
export function ContactSection({ section, ctx }: SectionProps<"contact">) {
  const { company } = ctx.site;
  const address = company.address.street ? fullAddress(company) : company.serviceArea;
  const rows: ContactRow[] = [
    ...(company.phone ? [{ icon: "Phone" as const, label: section.phoneLabel, value: company.phone, href: toTelHref(company.phone) }] : []),
    ...(company.email ? [{ icon: "Mail" as const, label: section.emailLabel, value: company.email, href: `mailto:${company.email}` }] : []),
    ...(address && section.addressLabel ? [{ icon: "MapPin" as const, label: section.addressLabel, value: address }] : []),
  ];
  const hours = company.openingHours
    .split(/[;\n]/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      // "Måndag–fredag: 08.00–17.00": the day on the left, the time on the right.
      const at = row.indexOf(":");
      return at > 0 ? [row.slice(0, at).trim(), row.slice(at + 1).trim()] : [row, ""];
    });

  return (
    <section id={section.anchor || undefined} className="sec">
      <div className="wrap contact">
        <div className="contact-info">
          <Eyebrow text={section.eyebrow} />
          {section.heading && <h2>{section.heading}</h2>}
          {section.text && <p className="lead">{section.text}</p>}
          <ul className="clist">
            {rows.map((row) => (
              <li key={row.icon}>
                <Icon name={row.icon} className="ic" />
                <span>
                  <small>{row.label}</small>
                  {row.href ? <a href={row.href}>{row.value}</a> : row.value}
                </span>
              </li>
            ))}
          </ul>
          {hours.length > 0 && (
            <>
              <p className="hours-h">{section.openingHoursLabel}</p>
              <ul className="hours">
                {hours.map(([day, time]) => (
                  <li key={day}>
                    <span>{day}</span>
                    <b>{time}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
          {section.orgLabel && company.orgNumber && <p className="small org">{`${section.orgLabel} ${company.orgNumber}`}</p>}
        </div>
        <div className="form-box">
          {section.formHeading && <p className="form-h">{section.formHeading}</p>}
          <QuoteForm variant="inline" content={quoteFormContent(ctx.site)} />
        </div>
      </div>
    </section>
  );
}
