"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { UppdragCard } from "./UppdragCard";
import { useInView, usePrefersReducedMotion } from "@/hooks/useInView";
import { fill } from "@/lib/site/format.ts";
import type { Uppdrag } from "@/lib/site/schema.ts";

const GAP_PX = 16;

export interface CarouselLabels {
  previous: string;
  next: string;
  /** {n} and {total} are filled in. */
  goTo: string;
}

export function UppdragCarousel({ items, labels }: { items: (Uppdrag & { id: string })[]; labels: CarouselLabels }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { ref: entranceRef, isInView } = useInView<HTMLDivElement>(0.15);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  // One dot per scroll position: every slide on mobile, fewer when 2–3 slides fit side by side.
  const [pageCount, setPageCount] = useState(items.length);
  const [activePage, setActivePage] = useState(0);

  const stepWidth = useCallback(() => {
    const slide = trackRef.current?.querySelector<HTMLElement>("[data-slide]");
    return slide ? slide.offsetWidth + GAP_PX : 1;
  }, []);

  const updateNavigation = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft < maxScroll - 4);
    const pages = Math.round(maxScroll / stepWidth()) + 1;
    setPageCount(pages);
    setActivePage(Math.min(pages - 1, Math.round(track.scrollLeft / stepWidth())));
  }, [stepWidth]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateNavigation();
    track.addEventListener("scroll", updateNavigation, { passive: true });
    window.addEventListener("resize", updateNavigation);
    return () => {
      track.removeEventListener("scroll", updateNavigation);
      window.removeEventListener("resize", updateNavigation);
    };
  }, [updateNavigation]);

  function step(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * stepWidth(), behavior: reducedMotion ? "auto" : "smooth" });
  }

  function goTo(page: number) {
    trackRef.current?.scrollTo({ left: page * stepWidth(), behavior: reducedMotion ? "auto" : "smooth" });
  }

  // The arrows fade out at either end instead of disappearing, and their chevron nudges the way it points on hover.
  const arrowClass =
    "group/nav absolute top-1/2 z-10 flex h-16 w-12 -translate-y-1/2 items-center justify-center bg-accent text-on-primary transition duration-200 hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-0";

  return (
    <div>
      <div ref={entranceRef} className="relative">
        {/* Phones: the current card sits in the middle with its neighbours peeking in on both sides. The spacers
            before the first and after the last card let those two centre as well. From sm up the cards line up
            from the left edge instead. */}
        <div
          ref={trackRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto before:w-[calc(8%-16px)] before:shrink-0 after:w-[calc(8%-16px)] after:shrink-0 sm:before:hidden sm:after:hidden"
        >
          {items.map((item, index) => (
            // Phones: the cards either side of the current one sit a little smaller and dimmer, shrinking away from
            // it, and grow to full size as they slide into the middle.
            <div
              key={item.id}
              data-slide
              className={`w-[84%] shrink-0 snap-center transition duration-300 ease-out sm:w-[calc((100%-16px)/2)] sm:snap-start lg:w-[calc((100%-32px)/3)] ${
                index === activePage
                  ? ""
                  : `max-sm:scale-[0.94] max-sm:opacity-60 ${index < activePage ? "max-sm:origin-right" : "max-sm:origin-left"}`
              }`}
            >
              {/* As the carousel comes into view the cards slide in from the right, one after another. */}
              <div
                className={`transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isInView ? "" : "translate-x-12 opacity-0"}`}
                style={{ transitionDelay: isInView ? `${Math.min(index, 4) * 90}ms` : "0ms" }}
              >
                <UppdragCard item={item} />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canPrev}
          aria-hidden={!canPrev}
          aria-label={labels.previous}
          className={`${arrowClass} left-0`}
        >
          <Icon
            name="ChevronLeft"
            strokeWidth={1.5}
            className="h-8 w-8 transition-transform duration-200 group-hover/nav:-translate-x-1"
          />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canNext}
          aria-hidden={!canNext}
          aria-label={labels.next}
          className={`${arrowClass} right-0`}
        >
          <Icon
            name="ChevronRight"
            strokeWidth={1.5}
            className="h-8 w-8 transition-transform duration-200 group-hover/nav:translate-x-1"
          />
        </button>
      </div>

      {pageCount > 1 && (
        <div className="mt-[15px] flex justify-center">
          {Array.from({ length: pageCount }, (_, page) => (
            <button
              key={page}
              type="button"
              onClick={() => goTo(page)}
              aria-label={fill(labels.goTo, { n: page + 1, total: pageCount })}
              aria-current={page === activePage ? "true" : undefined}
              className="group/dot px-[12.5px] py-[16.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {/* The current position stretches from a dot into a short bar. */}
              <span
                className={`block h-[11px] rounded-full transition-all duration-300 ease-out ${
                  page === activePage ? "w-7 bg-accent" : "w-[11px] bg-subtle group-hover/dot:bg-muted"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
