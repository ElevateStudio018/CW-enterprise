// Small building blocks of the public site's look (app/site.css): the eyebrow line, section headings, buttons and
// links in the approved design, all fed from the content.
import type { ReactNode } from "react";
import { Icon, type IconKey } from "../Icon";
import { SiteLink } from "../SiteLink";
import type { Link } from "@/lib/site/schema.ts";
import { toTelHref } from "@/lib/site/format.ts";

export function Eyebrow({ text }: { text: string }) {
  return text ? <p className="eyebrow">{text}</p> : null;
}

/** The heading row of a section: eyebrow and heading on the left, something (a link, a rating) on the right. */
export function SecHead({ eyebrow, heading, right }: { eyebrow: string; heading: string; right?: ReactNode }) {
  if (!eyebrow && !heading && !right) return null;
  return (
    <div className="sec-head">
      <div>
        <Eyebrow text={eyebrow} />
        {heading && <h2>{heading}</h2>}
      </div>
      {right}
    </div>
  );
}

export type BtnKind = "blue" | "dark" | "light" | "outline" | "ghost";

/** A pill button for a content link; `arrow` adds the round arrow at its end. Empty label: nothing. */
export function Btn({ link, kind = "blue", arrow = false, icon, small = false }: { link: Link; kind?: BtnKind; arrow?: boolean; icon?: IconKey; small?: boolean }) {
  if (!link.label) return null;
  return (
    <SiteLink href={link.href} className={`btn btn-${kind}${arrow ? " has-arrow" : ""}${small ? " btn-sm" : ""}`}>
      {icon && <Icon name={icon} className="ic" />}
      <span>{link.label}</span>
      {arrow && (
        <span className="btn-arrow">
          <Icon name="ArrowRight" className="ic" />
        </span>
      )}
    </SiteLink>
  );
}

/** The button that calls the company, "Ring 076-…" (or just the number). */
export function CallBtn({ phone, prefix, kind = "outline" }: { phone: string; prefix?: string; kind?: BtnKind }) {
  if (!phone) return null;
  return (
    <a href={toTelHref(phone)} className={`btn btn-${kind}`}>
      <Icon name="Phone" className="ic" />
      <span>{prefix ? `${prefix} ${phone}` : phone}</span>
    </a>
  );
}

/** A plain text link with an arrow, for the right-hand side of a section heading. */
export function MoreLink({ link }: { link: Link }) {
  if (!link.label) return null;
  return (
    <SiteLink href={link.href} className="more">
      {link.label} <Icon name="ArrowRight" className="ic" />
    </SiteLink>
  );
}

export function Stars({ n = 5, label }: { n?: number; label: string }) {
  if (n <= 0) return null;
  return (
    <span className="stars" role="img" aria-label={label.replace("{n}", String(n))}>
      {Array.from({ length: n }, (_, i) => (
        <Icon key={i} name="Star" className="ic" fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

/** Splits a text field into paragraphs at blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
