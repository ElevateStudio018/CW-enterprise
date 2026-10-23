import { Btn, CallBtn } from "../vk/parts";
import type { SectionProps } from "./types";

/** The coloured band before the footer: a heading and line on the left, the quote and call buttons on the right. */
export function CtaSection({ section, ctx }: SectionProps<"cta">) {
  return (
    <section id={section.anchor || undefined} className="cta">
      <div className="wrap cta-in">
        <div>
          {section.heading && <h2>{section.heading}</h2>}
          {section.text && <p>{section.text}</p>}
        </div>
        <div className="btns">
          <Btn link={section.button} kind="light" arrow />
          <CallBtn phone={ctx.site.company.phone} kind="outline" />
        </div>
      </div>
    </section>
  );
}
