"use client";

import { useId, useMemo, useState } from "react";
import { formatDate } from "@/lib/admin/dates";

interface Day {
  day: string;
  count: number;
}

const HEIGHT = 168;

/**
 * Quote requests per day as columns in the prime colour: thin columns with a rounded top, hairline grid, a tooltip on
 * hover and keyboard focus (arrow keys move between days), and the same numbers as a table for anyone who wants them.
 */
export function QuoteChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const max = Math.max(1, ...days.map((d) => d.count));
  // A clean top for the scale: the next even number, so the middle line is a whole number too.
  const top = max <= 2 ? 2 : Math.ceil(max / 2) * 2;
  const ticks = [top, top / 2, 0];
  const total = useMemo(() => days.reduce((sum, d) => sum + d.count, 0), [days]);
  const current = active !== null ? days[active] : null;

  return (
    <div>
      <div className="relative flex gap-2 pt-12">
        {/* Scale */}
        <div className="relative w-6 shrink-0 text-right text-[11px] tabular-nums text-admin-muted" style={{ height: HEIGHT }} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - tick / top) * 100}%` }}>
              {tick}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Grid: solid hairlines one step off the card */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: HEIGHT }} aria-hidden="true">
            {ticks.map((tick) => (
              <div key={tick} className="absolute inset-x-0 h-px bg-stone-200" style={{ top: `${(1 - tick / top) * 100}%` }} />
            ))}
          </div>

          <div
            role="group"
            aria-label={`Offertförfrågningar per dag, ${total} totalt de senaste ${days.length} dagarna. Piltangenterna går mellan dagarna.`}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const step = event.key === "ArrowRight" ? 1 : -1;
              setActive((index) => (index === null ? days.length - 1 : Math.min(days.length - 1, Math.max(0, index + step))));
            }}
            onFocus={() => setActive((index) => index ?? days.length - 1)}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            className="relative flex items-end rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-admin"
            style={{ height: HEIGHT }}
          >
            {days.map((day, index) => (
              // The whole column of the day is the target, not just the bar.
              <div key={day.day} onPointerEnter={() => setActive(index)} className="flex h-full flex-1 items-end justify-center px-px">
                <span
                  className={`block w-full max-w-[24px] rounded-t-[4px] bg-admin transition-opacity duration-150 ${
                    active !== null && active !== index ? "opacity-40" : "opacity-100"
                  }`}
                  style={{ height: day.count === 0 ? 0 : `${(day.count / top) * 100}%` }}
                />
              </div>
            ))}

            {current && (
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-xl bg-admin-ink px-3 py-2 text-white shadow-lg"
                style={{ left: `clamp(56px, ${((active! + 0.5) / days.length) * 100}%, calc(100% - 56px))` }}
                aria-live="polite"
              >
                <span className="block text-[15px] font-semibold">
                  {current.count} {current.count === 1 ? "förfrågan" : "förfrågningar"}
                </span>
                <span className="block text-[12px] text-white/70">{formatDate(current.day)}</span>
              </div>
            )}
          </div>

          <div className="mt-2 flex justify-between text-[11px] tabular-nums text-admin-muted" aria-hidden="true">
            <span>{formatDate(days[0].day)}</span>
            <span>{formatDate(days[Math.floor(days.length / 2)].day)}</span>
            <span>{formatDate(days[days.length - 1].day)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowTable((value) => !value)}
        aria-expanded={showTable}
        aria-controls={tableId}
        className="mt-3 min-h-11 rounded-lg text-[13px] font-semibold text-admin hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
      >
        {showTable ? "Dölj tabellen" : "Visa som tabell"}
      </button>
      <div id={tableId} hidden={!showTable} className="mt-1 max-h-64 overflow-y-auto rounded-xl ring-1 ring-admin-line">
        <table className="w-full text-[14px]">
          <caption className="sr-only">Offertförfrågningar per dag</caption>
          <thead className="sticky top-0 bg-stone-50 text-left text-[13px] font-semibold text-admin-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                Dag
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Förfrågningar
              </th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((day) => (
              <tr key={day.day} className="border-t border-admin-line">
                <td className="px-3 py-2">{formatDate(day.day, true)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
