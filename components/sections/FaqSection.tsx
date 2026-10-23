import { Icon } from "../Icon";
import { Eyebrow } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import { toTelHref } from "@/lib/site/format.ts";
import type { SectionProps } from "./types";

/** Questions and answers that open one at a time, with the phone number for anything else. */
export function FaqSection({ section, ctx }: SectionProps<"faq">) {
  const items = list(section.items);
  const { phone } = ctx.site.company;
  return (
    <section id={section.anchor || undefined} className="sec tint">
      <div className="wrap narrow">
        <Eyebrow text={section.eyebrow} />
        {section.heading && <h2>{section.heading}</h2>}
        {section.phonePrompt && phone && (
          <p>
            {`${section.phonePrompt} `}
            <a className="faq-tel" href={toTelHref(phone)}>
              {phone}
            </a>
          </p>
        )}
        <div className="faq">
          {items.map((item) => (
            <details key={item.id}>
              <summary>
                {item.question}
                <span className="pm" aria-hidden="true">
                  <Icon name="Plus" className="ic" />
                </span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
