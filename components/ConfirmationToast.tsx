"use client";

import { CONFIRMATION_MS, useQuoteModal } from "@/contexts/QuoteModalContext";

export function ConfirmationToast({ message }: { message: string }) {
  const { confirmationVisible } = useQuoteModal();

  return (
    <div
      aria-live="polite"
      className={`fixed left-1/2 top-24 z-[200] w-max max-w-full -translate-x-1/2 px-4 transition-all duration-400 ease-out ${
        confirmationVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
      }`}
    >
      <div className="relative flex items-center gap-3 overflow-hidden bg-success px-5 py-4 shadow-2xl">
        {/* The tick draws itself as the message appears. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-7 w-7 shrink-0 text-on-primary"
        >
          <path
            d="m4 12.5 5 5L20 6.5"
            pathLength={1}
            strokeDasharray={1}
            className={`transition-[stroke-dashoffset] duration-500 ease-out ${
              confirmationVisible ? "delay-200 [stroke-dashoffset:0]" : "[stroke-dashoffset:1]"
            }`}
          />
        </svg>
        <p className="text-[16px] font-semibold text-on-primary">{message}</p>
        {/* A thin line along the bottom runs out over the time the message stays. */}
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-0 h-[3px] origin-left bg-on-primary/30 ${confirmationVisible ? "animate-toast-timer" : "scale-x-0"}`}
          style={{ animationDuration: `${CONFIRMATION_MS}ms` }}
        />
      </div>
    </div>
  );
}
