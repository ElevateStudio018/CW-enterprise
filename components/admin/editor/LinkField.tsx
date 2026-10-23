"use client";

import { FieldGroup } from "../ui/FieldGroup";
import { useId, useMemo } from "react";
import { TextField, controlClasses } from "../ui/Field";
import { list } from "@/lib/site/collection.ts";
import { sectionTypeLabels } from "@/lib/site/labels.ts";
import type { Link, SiteData } from "@/lib/site/schema.ts";

const CUSTOM = "__custom";
const hrefPattern = /^(\/[^\s]*|#[A-Za-z0-9_-]*|https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\s()-]+)$/;

interface Target {
  value: string;
  label: string;
  group: string;
}

/** Everywhere a link can go on this site, named the way the owner knows the pages. */
export function linkTargets(draft: SiteData): Target[] {
  const targets: Target[] = [{ value: "#offert", label: "Öppna offertformuläret", group: "Vanligast" }];
  for (const page of list(draft.pages)) {
    targets.push({ value: page.slug ? `/${page.slug}` : "/", label: page.slug ? page.title : "Startsidan", group: "Sidor" });
  }
  const home = list(draft.pages).find((page) => page.slug === "");
  if (home) {
    for (const section of list(home.sections)) {
      if (!section.anchor) continue;
      const name = section.label || ("heading" in section && section.heading) || sectionTypeLabels[section.type].label;
      targets.push({ value: `/#${section.anchor}`, label: `Startsidan › ${name}`, group: "Avsnitt på startsidan" });
      targets.push({ value: `#${section.anchor}`, label: `${name} (avsnitt på samma sida)`, group: "Avsnitt på samma sida" });
    }
  }
  for (const service of list(draft.services)) {
    targets.push({ value: `/tjanster/${service.slug}`, label: service.name, group: "Tjänster" });
  }
  return targets;
}

/** Where a link goes: a page, part of a page or the quote form from a list, or an address of one's own. */
export function HrefField({ label, value, draft, onChange }: { label: string; value: string; draft: SiteData; onChange: (href: string) => void }) {
  const id = useId();
  const targets = useMemo(() => linkTargets(draft), [draft]);
  const known = targets.some((target) => target.value === value);
  const groups = Array.from(new Set(targets.map((target) => target.group)));
  const error = value && !hrefPattern.test(value) ? "Ange en webbadress (https://…), e-post (mailto:…), telefon (tel:…) eller en sida (/…)." : undefined;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-admin-ink">
          {label}
        </label>
        <select
          id={id}
          value={known ? value : CUSTOM}
          onChange={(event) => onChange(event.target.value === CUSTOM ? "https://" : event.target.value)}
          className={`${controlClasses} min-h-11`}
        >
          {groups.map((group) => (
            <optgroup key={group} label={group}>
              {targets
                .filter((target) => target.group === group)
                .map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value={CUSTOM}>Egen adress…</option>
        </select>
      </div>
      {!known && (
        <TextField
          label="Adress"
          value={value}
          onChange={(href) => onChange(href.trim())}
          placeholder="https://"
          inputMode="url"
          error={error}
        />
      )}
    </div>
  );
}

export function LinkField({ label, value, draft, onChange, allowEmpty = false }: { label: string; value: Link; draft: SiteData; onChange: (link: Link) => void; allowEmpty?: boolean }) {
  return (
    <FieldGroup label={label}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Text"
          value={value.label}
          recommended={30}
          onChange={(text) => onChange({ ...value, label: text })}
          hint={allowEmpty ? "Lämna tomt för att dölja knappen." : undefined}
        />
        <HrefField label="Leder till" value={value.href} draft={draft} onChange={(href) => onChange({ ...value, href })} />
      </div>
    </FieldGroup>
  );
}
