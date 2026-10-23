"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A modal window: focus stays inside while it is open, Escape or the cross closes it, and focus returns afterwards. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const returnTo = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelectorAll<HTMLElement>(FOCUSABLE)[1];
    first?.focus();
    // No layout jump: keep the scrollbar's space while the page behind cannot scroll.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const [firstItem, lastItem] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      returnTo.current?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" }[size];

  // Rendered at the end of <body>, so nothing on the page (an animation, a transform) can shift or clip it.
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6" role="presentation">
      <div className="admin-fade fixed inset-0 bg-stone-950/40 backdrop-blur-[2px]" aria-hidden="true" onMouseDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`admin-rise relative flex max-h-[92svh] w-full ${width} flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div>
            <h2 id={titleId} className="text-[19px] font-semibold text-admin-ink">
              {title}
            </h2>
            {description && <div className="mt-1 text-[14px] leading-relaxed text-admin-muted">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-admin-muted hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-admin-line px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
