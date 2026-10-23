"use client";

import { useId, useState } from "react";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

/** Plain rows split by thin lines; the answer opens under its question. */
export function FaqAccordion({ items }: { items: FaqEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const idPrefix = useId();

  return (
    <>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const buttonId = `${idPrefix}-trigger-${index}`;
        const panelId = `${idPrefix}-panel-${index}`;

        return (
          <div key={item.id} className="border-b border-line/15">
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-6 py-4 text-left text-[18px] font-bold leading-[1.25] text-heading transition-colors duration-200 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:py-5 lg:text-[20px]"
              >
                {item.question}
                {/* A downward chevron of two thin bars that pivot on its tip. Opening the answer turns both arms
                    flat into a minus, which rises to the middle; closing folds it back into the chevron. */}
                <span
                  aria-hidden="true"
                  className={`relative h-6 w-6 shrink-0 transition-transform duration-300 ease-out ${isOpen ? "-translate-y-[3px]" : ""}`}
                >
                  <span
                    className={`absolute right-[calc(50%-1px)] top-[14px] h-[2px] w-2 origin-[calc(100%-1px)_50%] rounded-full bg-current transition-transform duration-300 ease-out ${
                      isOpen ? "" : "rotate-45"
                    }`}
                  />
                  <span
                    className={`absolute left-[calc(50%-1px)] top-[14px] h-[2px] w-2 origin-[1px_50%] rounded-full bg-current transition-transform duration-300 ease-out ${
                      isOpen ? "" : "-rotate-45"
                    }`}
                  />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`grid overflow-hidden transition-all duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="pb-5 pr-10 text-copy leading-[1.4] text-body">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
