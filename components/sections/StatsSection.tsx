import { CountUp } from "../CountUp";
import { Reveal } from "../Reveal";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

// As many columns as figures, up to four, from sm up.
const columns = ["sm:grid-cols-1", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4"];

export function StatsSection({ section, id }: SectionProps<"stats">) {
  const headingId = `${id}-rubrik`;
  const year = new Date().getFullYear();
  const items = list(section.items);

  return (
    <section id={section.anchor || undefined} aria-labelledby={headingId} className="bg-primary text-center text-page">
      <div className="mx-auto max-w-content px-4 pb-[38px] pt-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <Reveal>
          <h2 id={headingId} className="text-h2 lg:text-h2-lg">
            {section.heading}
          </h2>
        </Reveal>
        <dl className={`mt-[26px] grid grid-cols-1 gap-y-5 ${columns[Math.min(items.length, 4)]} sm:gap-x-8 lg:mt-14`}>
          {items.map((stat, index) => {
            // A year counts the years since; amounts can count up when the band scrolls into view.
            const value = stat.valueType === "yearsSince" ? year - stat.value : stat.value;
            return (
              // The figures rise into place one after another. Number first visually, but the label stays the <dt> so
              // it is read before the value.
              <Reveal key={stat.id} delayMs={120 + index * 120} className="flex flex-col-reverse">
                <dt className="text-[17px] leading-[1.35] lg:text-[19px]">{stat.label}</dt>
                <dd className="text-stat text-on-primary lg:text-[72px]">{stat.countUp ? <CountUp value={value} /> : value}</dd>
              </Reveal>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
