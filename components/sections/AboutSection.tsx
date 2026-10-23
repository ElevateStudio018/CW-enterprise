import { Btn, Eyebrow, paragraphs } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

/** A photo with a round badge beside the company's own words, with a table of facts under them. */
export function AboutSection({ section }: SectionProps<"about">) {
  const facts = list(section.facts);
  return (
    <section id={section.anchor || undefined} className="sec">
      <div className="wrap split">
        <figure className="split-ph">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...imageProps(section.image, "(min-width: 960px) 45vw, 100vw")} alt={section.image.alt} style={focusStyle(section.image)} loading="lazy" />
          {section.badgeValue && (
            <span className="badge-round">
              <b>{section.badgeValue}</b>
              <span>{section.badgeLabel}</span>
            </span>
          )}
        </figure>
        <div>
          <Eyebrow text={section.eyebrow} />
          {section.heading && <h2>{section.heading}</h2>}
          {section.subheading && <p className="lead">{section.subheading}</p>}
          {paragraphs(section.text).map((text, i) => (
            <p key={i}>{text}</p>
          ))}
          {facts.length > 0 && (
            <dl className="facts">
              {facts.map((fact) => (
                <div key={fact.id}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {section.link.label && (
            <div className="btns">
              <Btn link={section.link} kind="ghost" arrow />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
