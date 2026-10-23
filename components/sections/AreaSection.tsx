import { Btn, Eyebrow } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

/** The places the company works in, as small chips, beside a map. */
export function AreaSection({ section, ctx }: SectionProps<"area">) {
  const places = list(section.places);
  const query = section.mapQuery || ctx.site.company.serviceArea;
  return (
    <section id={section.anchor || undefined} className="sec tint">
      <div className="wrap split split-map">
        <div>
          <Eyebrow text={section.eyebrow} />
          {section.heading && <h2>{section.heading}</h2>}
          {section.text && <p>{section.text}</p>}
          {places.length > 0 && (
            <ul className="chips chips-light">
              {places.map((place) => (
                <li key={place.id}>{place.label}</li>
              ))}
            </ul>
          )}
          {section.link.label && (
            <div className="btns">
              <Btn link={section.link} kind="dark" icon="MapPin" />
            </div>
          )}
        </div>
        {query && (
          <div className="map">
            <iframe
              src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=10&hl=sv&output=embed`}
              title={`${ctx.site.ui.mapTitlePrefix} ${query}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </div>
    </section>
  );
}
