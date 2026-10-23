"use client";

import { useEffect, useRef, useState } from "react";
import { QuoteForm, type QuoteFormContent } from "./QuoteForm";
import { useQuoteModal } from "@/contexts/QuoteModalContext";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function QuoteModal({ content, closeLabel }: { content: QuoteFormContent; closeLabel: string }) {
  const { isOpen, close } = useQuoteModal();
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      // Two frames later, so the hidden state has been drawn first and the fade, zoom and cross really animate.
      let secondFrame = 0;
      const firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setIsVisible(true));
      });
      return () => {
        cancelAnimationFrame(firstFrame);
        cancelAnimationFrame(secondFrame);
      };
    }

    setIsVisible(false);
    const timeout = setTimeout(() => setIsMounted(false), 300);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isMounted) return;

    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMounted, close]);

  if (!isMounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col overflow-y-auto p-4 transition-opacity ${
        isVisible ? "opacity-100 duration-200" : "opacity-0 duration-300"
      }`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="absolute inset-0 bg-primary/75" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-modal-heading"
        tabIndex={-1}
        className={`relative m-auto w-full max-w-md bg-card p-6 shadow-2xl transition-all sm:p-8 ${
          isVisible ? "scale-100 opacity-100 duration-200" : "scale-95 opacity-0 duration-300"
        }`}
      >
        <button
          type="button"
          onClick={close}
          aria-label={closeLabel}
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center text-heading transition-colors hover:bg-heading/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {/* Two thin bars that swing into a cross as the panel opens, drawn like the menu's close button. */}
          <span aria-hidden="true" className="relative h-6 w-6">
            {["rotate-45", "-rotate-45"].map((turn) => (
              <span
                key={turn}
                className={`absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-current transition-transform duration-300 ease-out ${
                  isVisible ? turn : ""
                }`}
              />
            ))}
          </span>
        </button>
        <h2 id="quote-modal-heading" className="mb-6 animate-rise-fast pr-10 text-[26px] font-semibold leading-tight text-heading [animation-delay:40ms]">
          {content.texts.modalHeading}
        </h2>
        <QuoteForm variant="modal" content={content} />
      </div>
    </div>
  );
}
