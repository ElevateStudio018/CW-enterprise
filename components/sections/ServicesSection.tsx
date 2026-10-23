import Link from "next/link";
import { Icon } from "../Icon";
import { Btn, MoreLink, SecHead } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { Service } from "@/lib/site/schema.ts";
import type { SectionProps } from "./types";

/** A service as a photo tile: its name and short text at the bottom, a round arrow in the corner. */
export function ServiceTile({ service }: { service: Service }) {
  return (
    <li className="tile">
      <Link href={`/tjanster/${service.slug}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...imageProps(service.image, "(min-width: 960px) 33vw, 100vw")} alt={service.image.alt} style={focusStyle(service.image)} loading="lazy" />
        <span className="tile-go">
          <Icon name="ArrowRight" className="ic" />
        </span>
        <span className="tile-text">
          <b>{service.name}</b>
          <span>{service.shortDescription}</span>
        </span>
      </Link>
    </li>
  );
}

/** Every service as a tile, then a box of smaller jobs and a coloured box that opens the quote form. */
export function ServicesSection({ section, ctx }: SectionProps<"services">) {
  const services = list(ctx.site.services);
  const more = list(section.moreItems);
  return (
    <section id={section.anchor || undefined} className="sec">
      <div className="wrap">
        <SecHead eyebrow={section.eyebrow} heading={section.heading} right={<MoreLink link={section.link} />} />
        <ul className="tiles">
          {services.map((service) => (
            <ServiceTile key={service.id} service={service} />
          ))}
          {section.moreHeading && (
            <li className="tile tile-list">
              <div>
                <p className="tile-h">{section.moreHeading}</p>
                <ul>
                  {more.map((item) => (
                    <li key={item.id}>
                      <Icon name="Check" className="ic" />
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          )}
          {section.ctaHeading && (
            <li className="tile tile-cta">
              <div>
                <p className="tile-h">{section.ctaHeading}</p>
                {section.ctaText && <p>{section.ctaText}</p>}
                <Btn link={section.ctaButton} kind="dark" arrow />
              </div>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
