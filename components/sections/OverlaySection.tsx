import { Btn, Eyebrow } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

/** A wide photo with a dark text box lying over its lower left corner. */
export function OverlaySection({ section }: SectionProps<"overlay">) {
  const chips = list(section.chips);
  return (
    <section id={section.anchor || undefined} className="sec sec-feature">
      <div className="wrap feature">
        <div className="feature-ph">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...imageProps(section.image, "(min-width: 960px) 70vw, 100vw")} alt={section.image.alt} style={focusStyle(section.image)} loading="lazy" />
        </div>
        <div className="feature-box">
          <Eyebrow text={section.eyebrow} />
          {section.heading && <h2>{section.heading}</h2>}
          {section.text && <p>{section.text}</p>}
          {chips.length > 0 && (
            <ul className="chips">
              {chips.map((chip) => (
                <li key={chip.id}>{chip.label}</li>
              ))}
            </ul>
          )}
          <Btn link={section.link} kind="outline" arrow />
        </div>
      </div>
    </section>
  );
}
