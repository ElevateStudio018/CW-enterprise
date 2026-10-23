import type { CSSProperties } from "react";
import { SecHead } from "../vk/parts";
import { ModelView } from "./model/ModelView";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

/** A 3D model the visitor can turn, beside the section's heading and text. */
export function ModelSection({ section }: SectionProps<"model">) {
  const parts = list(section.parts);
  return (
    <section id={section.anchor || undefined} className="sec model-sec">
      <div className="wrap model-grid">
        <div>
          <SecHead eyebrow={section.eyebrow} heading={section.heading} />
          {section.text && <p className="lead">{section.text}</p>}
          {parts.length > 0 && section.model === "koncern" && (
            <ul className="model-keys">
              {parts.map((part, i) => (
                <li key={part.id} data-highlight={i} style={part.color ? ({ "--key": part.color } as CSSProperties) : undefined}>
                  {part.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <figure className="model-figure">
          <ModelView model={section.model} labels={parts.map((part) => part.label)} colors={parts.map((part) => part.color)} />
          {section.caption && <figcaption>{section.caption}</figcaption>}
        </figure>
      </div>
    </section>
  );
}
