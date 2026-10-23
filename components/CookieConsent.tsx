"use client";

import { useEffect, useState } from "react";
import { buttonClasses } from "./Button";

const STORAGE_KEY = "cwe-cookies";
const OPEN_EVENT = "cwe:cookie-settings";

type Choice = "accepted" | "declined";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Google Analytics, loaded only after the visitor has said yes. */
function loadAnalytics(id: string) {
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = false;
  if (document.getElementById("ga-script")) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, { anonymize_ip: true });
  const script = document.createElement("script");
  script.id = "ga-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

/** Stops Analytics for the rest of the visit and removes its cookies, after a yes turned into a no. */
function stopAnalytics(id: string) {
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true;
  const host = window.location.hostname;
  const domains = ["", host, `.${host.split(".").slice(-2).join(".")}`];
  for (const name of document.cookie.split(";").map((cookie) => cookie.split("=")[0].trim())) {
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

/** Opens the question again (the footer's button). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** The question about statistics cookies, shown until the visitor answers; nothing is loaded before a yes. */
export function CookieConsent({ analyticsId, text, accept, decline }: { analyticsId: string; text: string; accept: string; decline: string }) {
  const [choice, setChoice] = useState<Choice | null | undefined>(undefined);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage may be off; then the question is asked each visit.
    }
    setChoice(stored === "accepted" || stored === "declined" ? stored : null);
    const reopen = () => setChoice(null);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (choice === "accepted") loadAnalytics(analyticsId);
  }, [choice, analyticsId]);

  function answer(next: Choice) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Remembered for this visit only.
    }
    if (next === "declined") stopAnalytics(analyticsId);
    setChoice(next);
  }

  if (choice !== null) return null;
  return (
    <div
      role="region"
      aria-label={text}
      className="fixed inset-x-3 bottom-3 z-[250] mx-auto max-w-xl animate-rise-fast bg-card p-5 shadow-[0_18px_48px_-16px_rgba(0,0,0,0.35)] ring-1 ring-line/10 sm:inset-x-6 sm:bottom-6 sm:p-6"
    >
      <p className="text-[16px] leading-relaxed text-body">{text}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => answer("accepted")} className={buttonClasses("solid", "!px-6 !py-3")}>
          {accept}
        </button>
        <button type="button" onClick={() => answer("declined")} className={buttonClasses("outline", "!px-6 !py-3")}>
          {decline}
        </button>
      </div>
    </div>
  );
}
