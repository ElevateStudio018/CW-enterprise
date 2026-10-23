"use client";

import { useState } from "react";
import { Reveal } from "./Reveal";
import { UppdragCard } from "./UppdragCard";
import type { Uppdrag } from "@/lib/site/schema.ts";

// The "all" filter, kept apart from the tags themselves whatever it is called.
const ALL = "";

export function UppdragGrid({ items, allLabel, filterLabel }: { items: (Uppdrag & { id: string })[]; allLabel: string; filterLabel: string }) {
  const tags = Array.from(new Set(items.map((item) => item.tag)));
  const [activeTag, setActiveTag] = useState(ALL);
  const visibleItems = activeTag === ALL ? items : items.filter((item) => item.tag === activeTag);

  return (
    <div>
      <div className="mb-10 flex flex-wrap gap-3" role="group" aria-label={filterLabel}>
        {[ALL, ...tags].map((tag) => {
          const isActive = activeTag === tag;
          return (
            <button
              key={tag || "alla"}
              type="button"
              onClick={() => setActiveTag(tag)}
              aria-pressed={isActive}
              className={`rounded-full border-2 border-accent px-5 py-2.5 text-label uppercase transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isActive ? "bg-accent text-on-primary" : "text-accent hover:bg-accent hover:text-on-primary"
              }`}
            >
              {tag || allLabel}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item, index) => (
          <Reveal key={item.id} delayMs={(index % 3) * 70}>
            <UppdragCard item={item} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
