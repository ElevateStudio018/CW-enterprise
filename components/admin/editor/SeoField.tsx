"use client";

import { FieldGroup } from "../ui/FieldGroup";
import { TextArea, TextField } from "../ui/Field";

const TITLE_FITS = 60;
const DESCRIPTION_FITS = 155;

function cut(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()} …` : text;
}

/** The page's title and description for search engines, with roughly how Google shows them. */
export function SeoField({
  label,
  value,
  onTitle,
  onDescription,
  url,
  siteName,
  isHome,
}: {
  label: string;
  value: { title: string; description: string };
  onTitle: (title: string) => void;
  onDescription: (description: string) => void;
  /** The page's full address. */
  url: string;
  siteName: string;
  isHome: boolean;
}) {
  // Every page but the start page has the site's name after its own title (see app/layout.tsx).
  const shownTitle = isHome ? value.title : `${value.title} | ${siteName}`;
  let crumbs = url;
  try {
    const parsed = new URL(url);
    crumbs = [parsed.hostname.replace(/^www\./, ""), ...parsed.pathname.split("/").filter(Boolean)].join(" › ");
  } catch {
    // An address being typed; shown as it is.
  }

  return (
    <FieldGroup label={label}>
      <div className="space-y-4">
        <TextField label="Titel i sökresultatet" value={value.title} onChange={onTitle} recommended={TITLE_FITS} hint="Det blåa, klickbara i Googles resultat." />
        <TextArea
          label="Beskrivning i sökresultatet"
          value={value.description}
          onChange={onDescription}
          recommended={DESCRIPTION_FITS}
          rows={3}
          hint="Texten under titeln. En eller två meningar om vad sidan erbjuder."
        />
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-admin-muted">Ungefär så här visas sidan på Google</p>
          <div className="rounded-xl bg-white p-4 ring-1 ring-admin-line" aria-hidden="true">
            <p className="truncate text-[13px] text-[#4d5156]">{crumbs}</p>
            <p className="mt-0.5 text-[19px] leading-snug text-[#1a0dab]">{cut(shownTitle || "(ingen titel)", TITLE_FITS + 4)}</p>
            <p className="mt-1 text-[14px] leading-snug text-[#4d5156]">{cut(value.description || "(ingen beskrivning – Google väljer då själv en text från sidan)", DESCRIPTION_FITS + 4)}</p>
          </div>
        </div>
      </div>
    </FieldGroup>
  );
}
