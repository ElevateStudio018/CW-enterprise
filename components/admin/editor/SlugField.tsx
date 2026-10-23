"use client";

import { TextField } from "../ui/Field";

/** "Grävning & Schakt" → "gravning-schakt": what an address may hold. */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 80);
}

/** The last part of a page's address, kept to letters, digits and hyphens, and never one that is taken. */
export function SlugField({
  label,
  value,
  prefix,
  taken,
  onChange,
  hint,
  suggestion,
}: {
  label: string;
  value: string;
  /** What comes before it, e.g. "/tjanster/". */
  prefix: string;
  /** Addresses already used by others. */
  taken: string[];
  onChange: (slug: string) => void;
  hint?: string;
  /** An address made from the page's name, offered with one tap. */
  suggestion?: string;
}) {
  const error = !value ? "Ange en adress." : taken.includes(value) ? "Adressen används redan av en annan sida." : undefined;
  return (
    <div>
      <TextField
        label={label}
        value={value}
        onChange={(text) => onChange(toSlug(text))}
        error={error}
        hint={hint}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-admin-muted">
        <span>
          Adress: <span className="font-mono text-admin-ink">{prefix}{value || "…"}</span>
        </span>
        {suggestion && suggestion !== value && !taken.includes(suggestion) && (
          <button
            type="button"
            onClick={() => onChange(suggestion)}
            className="min-h-11 font-semibold text-admin underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
          >
            Använd ”{suggestion}”
          </button>
        )}
      </p>
    </div>
  );
}
