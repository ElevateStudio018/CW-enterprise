import { Icon } from "../Icon";
import { SecHead } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

/** A dark band: heading and text, then a few cards with a symbol each. */
export function ValuesSection({ section }: SectionProps<"values">) {
  const items = list(section.items);
  return (
    <section id={section.anchor || undefined} className="band">
      <div className="wrap">
        <SecHead eyebrow={section.eyebrow} heading={section.heading} right={section.text ? <p className="band-lead">{section.text}</p> : undefined} />
        <ul className="values">
          {items.map((item) => (
            <li key={item.id}>
              <Icon name={item.icon} className="ic" />
              <h3>{item.heading}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
