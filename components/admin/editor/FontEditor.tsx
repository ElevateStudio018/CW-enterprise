"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Type } from "lucide-react";
import { Card } from "../ui/Card";
import { AdminButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { fontCategoryLabels, fontOption, fontOptions, googleFontsHref, type FontOption } from "@/lib/site/fonts.ts";
import { fontRoleLabels } from "@/lib/site/labels.ts";
import { fontStack } from "@/lib/site/theme.ts";
import { list } from "@/lib/site/collection.ts";
import { homePage } from "@/lib/site/pages.ts";
import type { FontChoice, SiteData } from "@/lib/site/schema.ts";

type Role = keyof typeof fontRoleLabels;
const roles: Role[] = ["heading", "body", "button"];

/** Adds a Google Fonts stylesheet to the admin once. Figtree is already on the page. */
function useFontCss(href: string | null) {
  useEffect(() => {
    if (!href || document.querySelector(`link[data-font-href="${CSS.escape(href)}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.fontHref = href;
    document.head.appendChild(link);
  }, [href]);
}

/** The site's own words for showing a font: its main heading, a paragraph and a button. */
function samples(site: SiteData): Record<Role, string> {
  const home = homePage(site);
  const sections = list(home.sections);
  const hero = sections.find((section) => section.type === "hero");
  const about = sections.find((section) => section.type === "about");
  const paragraph = about?.type === "about" ? about.text : "";
  const short = paragraph.length > 180 ? `${paragraph.slice(0, paragraph.lastIndexOf(" ", 180))} …` : paragraph;
  return {
    heading: (hero?.type === "hero" && hero.heading) || site.company.legalName,
    body: short || site.company.serviceArea,
    button: (hero?.type === "hero" && hero.button.label) || site.form.submit,
  };
}

function Sample({ role, font, text, large = false }: { role: Role; font: FontChoice; text: string; large?: boolean }) {
  const style = { fontFamily: fontStack(font) };
  if (role === "heading") {
    return (
      <p style={style} className={`font-semibold leading-tight text-admin-ink ${large ? "text-[34px] tracking-[-0.01em]" : "text-[24px]"}`}>
        {text}
      </p>
    );
  }
  if (role === "button") {
    return (
      <span style={style} className="inline-flex min-h-11 items-center rounded-full bg-admin-ink px-6 text-[15px] font-bold uppercase tracking-[0.03em] text-white">
        {text}
      </span>
    );
  }
  return (
    <p style={style} className={`leading-relaxed text-admin-ink ${large ? "text-[18px]" : "text-[16px]"}`}>
      {text}
    </p>
  );
}

/** A row in the font list, drawn in its own font, which loads (just the letters needed) when it scrolls into view. */
function FontRow({ option, selected, onSelect }: { option: FontOption; selected: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useFontCss(visible && option.family !== "Figtree" ? googleFontsHref([option.family], `${option.family}Aaåäö`) : null);

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
        selected ? "bg-admin/10 ring-1 ring-admin/40" : "hover:bg-stone-50"
      }`}
    >
      <span style={{ fontFamily: fontStack(option) }} className="truncate text-[19px] text-admin-ink">
        {option.family}
      </span>
      <span className="shrink-0 text-[12px] text-admin-muted">{fontCategoryLabels[option.category]}</span>
    </button>
  );
}

function FontPicker({ role, current, site, onClose }: { role: Role; current: FontChoice; site: SiteData; onClose: () => void }) {
  const { store } = useDraft();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FontChoice["category"] | "all">("all");
  const [chosen, setChosen] = useState<FontOption>(fontOption(current.family) ?? fontOptions[0]);
  const text = samples(site)[role];
  useFontCss(chosen.family !== "Figtree" ? googleFontsHref([chosen.family]) : null);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return fontOptions.filter((option) => (category === "all" || option.category === category) && (!words || option.family.toLowerCase().includes(words)));
  }, [query, category]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Typsnitt för ${fontRoleLabels[role].toLowerCase()}`}
      size="lg"
      footer={
        <>
          <AdminButton variant="secondary" onClick={onClose}>
            Avbryt
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={() => {
              store.setFont(role, chosen.family, chosen.category);
              toast.success(`${fontRoleLabels[role]} visas nu i ${chosen.family}.`);
              onClose();
            }}
          >
            Använd {chosen.family}
          </AdminButton>
        </>
      }
    >
      <div className="rounded-2xl bg-stone-50 p-5 ring-1 ring-admin-line" aria-live="polite">
        <p className="mb-3 text-[13px] font-semibold text-admin-muted">Så här ser det ut med {chosen.family}</p>
        <Sample role={role} font={chosen} text={text} large />
        {chosen.weights.length < 3 && (
          <p className="mt-3 text-[13px] text-admin-muted">{chosen.family} finns bara i några få tjocklekar; fetstil kan se lite annorlunda ut.</p>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <span className="sr-only">Sök typsnitt</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök bland typsnitten"
            className="min-h-11 w-full rounded-xl border-0 bg-white pl-10 pr-3 text-[16px] sm:text-[15px] text-admin-ink ring-1 ring-inset ring-admin-line focus:outline-none focus:ring-2 focus:ring-admin"
            data-autofocus
          />
        </label>
        <select
          aria-label="Typ av typsnitt"
          value={category}
          onChange={(event) => setCategory(event.target.value as FontChoice["category"] | "all")}
          className="min-h-11 rounded-xl border-0 bg-white px-3 text-[16px] sm:text-[15px] text-admin-ink ring-1 ring-inset ring-admin-line focus:outline-none focus:ring-2 focus:ring-admin"
        >
          <option value="all">Alla sorter</option>
          {Object.entries(fontCategoryLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <ul aria-label="Typsnitt" className="mt-3 max-h-[40svh] space-y-1 overflow-y-auto pr-1">
        {shown.map((option) => (
          <li key={option.family}>
            <FontRow option={option} selected={option.family === chosen.family} onSelect={() => setChosen(option)} />
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="px-4 py-6 text-center text-[14px] text-admin-muted">Inget typsnitt heter så. Prova ett annat ord.</p>}
    </Dialog>
  );
}

/** The three fonts of the site (headings, text, buttons), each shown in the site's own words. */
export function FontEditor() {
  const { draft } = useDraft();
  const [choosing, setChoosing] = useState<Role | null>(null);
  const fonts = draft?.theme.fonts;
  const families = fonts ? Array.from(new Set(roles.map((role) => fonts[role].family))).filter((family) => family !== "Figtree") : [];
  useFontCss(families.length > 0 ? googleFontsHref(families) : null);
  if (!draft || !fonts) return null;
  const text = samples(draft);

  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <Card key={role}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold text-admin-ink">{fontRoleLabels[role]}</h2>
              <p className="mt-0.5 text-[14px] text-admin-muted">
                {fonts[role].family} · {fontCategoryLabels[fonts[role].category]}
              </p>
            </div>
            <AdminButton size="sm" icon={Type} onClick={() => setChoosing(role)}>
              Byt typsnitt
            </AdminButton>
          </div>
          <div className="mt-5 rounded-xl bg-stone-50 p-4 ring-1 ring-admin-line">
            <Sample role={role} font={fonts[role]} text={text[role]} />
          </div>
        </Card>
      ))}
      <p className="px-1 text-[13px] leading-relaxed text-admin-muted">
        Typsnitten kommer från Google Fonts. När du publicerar laddas de ner till hemsidan, så besökarnas webbläsare behöver inte hämta något från Google.
      </p>
      {choosing && <FontPicker role={choosing} current={fonts[choosing]} site={draft} onClose={() => setChoosing(null)} />}
    </div>
  );
}
