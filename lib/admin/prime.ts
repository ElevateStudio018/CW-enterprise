// The admin's own prime colour: applied as CSS variables, remembered in this browser so the panel opens in it.
import { contrastRatio, hexToChannels } from "@/lib/site/theme.ts";

export const DEFAULT_PRIME = "#1C2817";
const STORAGE_KEY = "cwe-admin-prime";

/** White or near-black, whichever reads better on the prime colour. */
export function primeContrast(hex: string): string {
  return contrastRatio(hex, "#FFFFFF") >= contrastRatio(hex, "#1E1E1C") ? "#FFFFFF" : "#1E1E1C";
}

export function applyPrime(hex: string) {
  const root = document.documentElement;
  root.style.setProperty("--admin-primary", hexToChannels(hex));
  root.style.setProperty("--admin-primary-contrast", hexToChannels(primeContrast(hex)));
  try {
    localStorage.setItem(STORAGE_KEY, hex);
  } catch {
    // Private windows may refuse; the colour still applies for this visit.
  }
}

/** Runs before the panel is drawn (inline in the admin layout), so it never flashes the default colour. */
export const primeBootScript = `try{var h=localStorage.getItem("${STORAGE_KEY}");if(/^#[0-9a-fA-F]{6}$/.test(h)){var n=parseInt(h.slice(1),16),r=n>>16&255,g=n>>8&255,b=n&255;document.documentElement.style.setProperty("--admin-primary",r+" "+g+" "+b);var l=function(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};var L=0.2126*l(r)+0.7152*l(g)+0.0722*l(b);document.documentElement.style.setProperty("--admin-primary-contrast",(1.05/(L+0.05))>=((L+0.05)/(0.0129+0.05))?"255 255 255":"30 30 28")}}catch(e){}`;
