import { Icon } from "../Icon";
import { SecHead } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

/** The steps from first contact to finished work, each with a symbol and a large number. */
export function ProcessSection({ section }: SectionProps<"process">) {
  const steps = list(section.steps);
  return (
    <section id={section.anchor || undefined} className="sec">
      <div className="wrap">
        <SecHead eyebrow={section.eyebrow} heading={section.heading} right={section.text ? <p>{section.text}</p> : undefined} />
        <ol className="steps">
          {steps.map((step, index) => (
            <li key={step.id}>
              <span className="step-top">
                <Icon name={step.icon} className="ic" />
                <span className="step-no">{String(index + 1).padStart(2, "0")}</span>
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
