import { DropPin } from "../DropPin";
import { Reveal } from "../Reveal";
import { ArrowLabel, arrowLinkClasses } from "../Button";
import { fullAddress } from "@/lib/site/format.ts";
import type { SectionProps } from "./types";

export function MapSection({ section, id, ctx }: SectionProps<"map">) {
  const { company, ui } = ctx.site;
  // By coordinates rather than the address text, which Google has placed in Norway.
  const { lat, lng } = company.address.geo;
  const address = fullAddress(company);
  const headingId = `${id}-rubrik`;

  return (
    <section id={section.anchor || undefined} aria-labelledby={headingId}>
      <div className="mx-auto max-w-content px-4 pb-10 text-center sm:px-6 lg:px-8 lg:pb-14">
        <Reveal>
          <h2 id={headingId} className="text-h2 text-heading lg:text-h2-lg">
            {section.heading}
          </h2>
        </Reveal>
      </div>

      <div className="h-[350px] w-full bg-primary/20">
        <iframe
          src={`https://www.google.com/maps?q=${lat},${lng}&z=${section.zoom}&hl=sv&output=embed`}
          title={`${ui.mapTitlePrefix} ${company.legalName}, ${address}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full border-0"
        />
      </div>

      <div className="bg-field">
        <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="flex items-center gap-3 text-[18px] text-heading">
            <DropPin className="flex shrink-0" />
            {`${section.addressPrefix} `}
            {address}
          </p>
          {section.linkLabel && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className={arrowLinkClasses()}
            >
              <ArrowLabel>{section.linkLabel}</ArrowLabel>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
