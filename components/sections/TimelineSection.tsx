import { SecHead } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** "2025-06" as a month number counted from year 0, or null when empty. */
function monthIndex(value: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
}

function monthLabel(index: number): string {
  return `${MONTHS[index % 12]} ${Math.floor(index / 12)}`;
}

/** Assignments as bars on a month scale (a Gantt chart), with the years along the top. */
export function TimelineSection({ section }: SectionProps<"timeline">) {
  const items = list(section.items)
    .map((item) => ({ ...item, from: monthIndex(item.start), to: monthIndex(item.end) }))
    .filter((item): item is typeof item & { from: number } => item.from !== null);
  const now = new Date().getFullYear() * 12 + new Date().getMonth();
  const first = Math.min(...items.map((item) => item.from));
  const last = Math.max(...items.map((item) => item.to ?? now));
  const span = items.length ? last - first + 1 : 0;

  const years: { year: number; start: number; length: number }[] = [];
  for (let m = first; items.length && m <= last; ) {
    const year = Math.floor(m / 12);
    const end = Math.min(last, year * 12 + 11);
    years.push({ year, start: m - first + 1, length: end - m + 1 });
    m = end + 1;
  }

  return (
    <section id={section.anchor || undefined} className="band timeline-sec">
      <div className="wrap">
        <SecHead eyebrow={section.eyebrow} heading={section.heading} right={section.text ? <p className="band-lead">{section.text}</p> : undefined} />
        {items.length > 0 && (
          <div className="gantt-wrap">
            <ol className="gantt" style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }} aria-label={section.heading}>
              {years.map((y) => (
                <li key={y.year} className="gantt-year" aria-hidden="true" style={{ gridColumn: `${y.start} / span ${y.length}` }}>
                  {y.year}
                </li>
              ))}
              {items.map((item, row) => (
                <li
                  key={item.id}
                  className="gantt-bar"
                  style={{ gridColumn: `${item.from - first + 1} / ${(item.to ?? now) - first + 2}`, gridRow: row + 2 }}
                >
                  <b>{item.title}</b>
                  {item.text && <span className="gantt-text">{item.text}</span>}
                  <small>
                    {monthLabel(item.from)} – {item.to !== null ? monthLabel(item.to) : "pågår"}
                  </small>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
