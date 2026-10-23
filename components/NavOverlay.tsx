"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BurgerIcon, burgerButtonClasses } from "./BurgerIcon";
import { Icon } from "./Icon";
import { Wordmark } from "./Wordmark";
import { buttonClasses } from "./Button";
import type { NavContent } from "./Navbar";
import { toTelHref } from "@/lib/site/format.ts";
import { useQuoteModal } from "@/contexts/QuoteModalContext";
import { usePrefersReducedMotion } from "@/hooks/useInView";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface NavRow {
  number: string;
  label: string;
  href: string;
}

/** Classes and delay that slide one part of the menu up into place as the menu opens. */
interface Entrance {
  className: string;
  style: CSSProperties;
}

function RowLink({ row, onClose, entrance, isCurrent }: { row: NavRow; onClose: () => void; entrance: Entrance; isCurrent: boolean }) {
  return (
    <li className={`border-b border-nav-text/15 py-4 ${entrance.className}`} style={entrance.style}>
      <Link href={row.href} onClick={onClose} aria-current={isCurrent ? "page" : undefined} className="group flex items-baseline gap-4">
        <span
          className={`text-sm font-bold transition-colors duration-300 group-hover:text-nav-text ${isCurrent ? "text-nav-text" : "text-nav-text/50"}`}
        >
          {row.number}
        </span>
        {/* The page you are on is underlined. */}
        <span
          className={`text-3xl font-semibold text-nav-text transition duration-300 ease-out group-hover:translate-x-2 group-hover:text-nav-text/70 sm:text-4xl lg:text-5xl ${
            isCurrent ? "underline decoration-2 underline-offset-[10px]" : ""
          }`}
        >
          {row.label}
        </span>
      </Link>
    </li>
  );
}

export function NavOverlay({ content, onClose }: { content: NavContent; onClose: () => void }) {
  const { services, labels } = content;
  const rows = content.menu.map((row, index) => ({ ...row, number: String(index + 1).padStart(2, "0") }));
  const pathname = usePathname();
  const current = pathname.replace(/\/$/, "") || "/";
  const { open: openQuoteModal } = useQuoteModal();
  const overlayRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  // Set a moment after opening, so that what changes with it animates: the close button (sitting exactly where the
  // menu button was) turns from the same bars into a cross, and the rows slide up into place one after another.
  const [hasEntered, setHasEntered] = useState(false);
  // On short screens the list runs on below the bottom bar; while it does, its lower edge fades out.
  const [moreBelow, setMoreBelow] = useState(false);

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setHasEntered(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    const focusable = overlay?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !overlay) return;
      const items = overlay.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
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
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const list = nav;

    function updateMoreBelow() {
      setMoreBelow(list.scrollTop + list.clientHeight < list.scrollHeight - 4);
    }

    updateMoreBelow();
    list.addEventListener("scroll", updateMoreBelow, { passive: true });
    window.addEventListener("resize", updateMoreBelow);
    return () => {
      list.removeEventListener("scroll", updateMoreBelow);
      window.removeEventListener("resize", updateMoreBelow);
    };
  }, []);

  function entrance(order: number): Entrance {
    return {
      className: `transition duration-300 ease-out ${hasEntered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`,
      style: { transitionDelay: reducedMotion ? "0ms" : `${40 + order * 35}ms` },
    };
  }

  function handleCtaClick() {
    onClose();
    openQuoteModal();
  }

  return (
    <div ref={overlayRef} role="dialog" aria-modal="true" aria-label={labels.menu} className="fixed inset-0 z-[60] flex flex-col bg-nav pr-[var(--scrollbar-width,0px)]">
      <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link href="/" onClick={onClose} aria-label={labels.homeLink} className="flex min-h-12 items-center text-nav-text">
          <Wordmark content={content.logo} />
        </Link>
        <button type="button" onClick={onClose} aria-label={labels.closeMenu} className={burgerButtonClasses}>
          <BurgerIcon cross={hasEntered} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <nav ref={navRef} aria-label={labels.mainMenu} className="h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <ul className="mx-auto max-w-content">
            {rows.map((row, index) =>
              row.kind === "services" ? (
                <li key={row.id} className={`border-b border-nav-text/15 py-4 ${entrance(index).className}`} style={entrance(index).style}>
                  <div className="flex items-baseline gap-4">
                    <span className={`text-sm font-bold ${current.startsWith("/tjanster/") ? "text-nav-text" : "text-nav-text/50"}`}>{row.number}</span>
                    <span className="text-3xl font-semibold text-nav-text sm:text-4xl lg:text-5xl">{row.label}</span>
                  </div>
                  <ul className="ml-[2.6rem] mt-2.5 grid grid-cols-1 gap-x-10 sm:grid-cols-2 xl:grid-cols-4">
                    {services.map((service) => (
                      <li key={service.slug}>
                        <Link
                          href={`/tjanster/${service.slug}`}
                          onClick={onClose}
                          aria-current={current === `/tjanster/${service.slug}` ? "page" : undefined}
                          className={`block py-3 text-[17px] transition duration-300 ease-out hover:translate-x-1.5 hover:text-nav-text ${
                            current === `/tjanster/${service.slug}` ? "text-nav-text underline underline-offset-[6px]" : "text-nav-text/75"
                          }`}
                        >
                          {service.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <RowLink key={row.id} row={row} onClose={onClose} entrance={entrance(index)} isCurrent={current === row.href} />
              )
            )}
          </ul>
        </nav>
        {/* The rows fade into the background where the list runs on, rather than being cut off by the bottom bar. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-nav to-nav/0 transition-opacity duration-300 ${
            moreBelow ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <div
        className={`border-t border-nav-text/15 px-4 py-6 sm:px-6 lg:px-8 ${entrance(rows.length).className}`}
        style={entrance(rows.length).style}
      >
        <div className="mx-auto flex max-w-content flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={handleCtaClick} className={buttonClasses("on-nav", "w-full sm:w-auto")}>
            {content.menuButton}
          </button>
          {content.phone && (
            <a href={toTelHref(content.phone)} className="flex items-center gap-3 text-[18px] font-semibold text-nav-text hover:text-nav-text/70">
              <Icon name="Phone" className="h-5 w-5 text-nav-text/60" />
              {content.phone}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
