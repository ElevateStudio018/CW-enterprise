"use client";

import { tapTarget } from "./Button";
import { openCookieSettings } from "./CookieConsent";

/** In the footer: lets visitors change their answer about statistics cookies. */
export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={`${tapTarget} underline underline-offset-2 hover:text-footer-text`}>
      {label}
    </button>
  );
}
