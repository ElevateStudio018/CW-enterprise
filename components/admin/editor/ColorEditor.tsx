"use client";

import { useEffect, useState } from "react";
import { Check, TriangleAlert, Wand2 } from "lucide-react";
import { Card, CardHeader } from "../ui/Card";
import { AdminButton } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { colorRoleLabels } from "@/lib/site/labels.ts";
import { contrastProblems, contrastRatio } from "@/lib/site/theme.ts";
import { colorRoles, type ColorRole } from "@/lib/site/schema.ts";
import { palettes } from "@/lib/admin/palettes";
import { DEFAULT_PRIME } from "@/lib/admin/prime";

/** "#abc", "abc", "aabbcc" → "#AABBCC"; null when it is not a colour code. */
export function parseHex(text: string): string | null {
  let hex = text.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) hex = hex.replace(/./g, (c) => c + c);
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : null;
}

function mix(from: string, to: string, amount: number): string {
  const a = Number.parseInt(from.slice(1), 16);
  const b = Number.parseInt(to.slice(1), 16);
  const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** The nearest colour to `text` (darker or lighter) that reads well enough on `background`. */
export function fixContrast(text: string, background: string, required: number): string {
  const towards = contrastRatio(background, "#000000") > contrastRatio(background, "#FFFFFF") ? "#000000" : "#FFFFFF";
  for (let amount = 0.04; amount <= 1; amount += 0.04) {
    const candidate = mix(text, towards, amount);
    if (contrastRatio(candidate, background) >= required + 0.05) return candidate;
  }
  return towards;
}

/** A colour: a swatch that opens the system's colour picker, and its code to type or paste. */
export function ColorInput({ label, hint, value, onChange, warning }: { label: string; hint?: string; value: string; onChange: (hex: string) => void; warning?: string }) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);
  const invalid = parseHex(text) === null;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-black/10 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-admin" style={{ background: value }}>
        <span className="sr-only">Välj färg: {label}</span>
        <input type="color" value={value.toLowerCase()} onChange={(event) => onChange(event.target.value.toUpperCase())} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[14px] font-semibold text-admin-ink">
          {label}
          {warning && (
            <span title={warning} className="text-amber-700">
              <TriangleAlert aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">{warning}</span>
            </span>
          )}
        </p>
        {hint && <p className="text-[13px] leading-snug text-admin-muted">{hint}</p>}
      </div>
      <input
        aria-label={`${label}, färgkod`}
        aria-invalid={invalid || undefined}
        value={text}
        spellCheck={false}
        autoCapitalize="characters"
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(value);
        }}
        onChange={(event) => {
          setText(event.target.value);
          const hex = parseHex(event.target.value);
          if (hex) onChange(hex);
        }}
        className={`min-h-11 w-[104px] shrink-0 rounded-xl border-0 bg-white px-3 font-mono text-[16px] sm:text-[14px] uppercase text-admin-ink ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-admin ${
          invalid ? "ring-red-400" : "ring-admin-line"
        }`}
      />
    </div>
  );
}

const primeSuggestions = [
  { hex: DEFAULT_PRIME, name: "Skogsgrön" },
  { hex: "#1F2933", name: "Grafit" },
  { hex: "#123A5A", name: "Marinblå" },
  { hex: "#0F766E", name: "Petrol" },
  { hex: "#4C3B8F", name: "Lila" },
  { hex: "#9A3412", name: "Rost" },
];

/** Every colour of the site, ready-made palettes, contrast warnings, and apart from them the admin's own colour. */
export function ColorEditor() {
  const { draft, adminColors, store } = useDraft();
  const toast = useToast();
  if (!draft) return null;
  const colors = draft.theme.colors;
  const problems = contrastProblems(colors);
  const groups = Array.from(new Set(colorRoles.map((role) => colorRoleLabels[role].group)));
  const prime = adminColors.primary ?? DEFAULT_PRIME;

  function warningFor(role: ColorRole): string | undefined {
    const problem = problems.find((p) => p.text === role || p.background === role);
    if (!problem) return undefined;
    return `Svag kontrast: ${colorRoleLabels[problem.text].label.toLowerCase()} på ${colorRoleLabels[problem.background].label.toLowerCase()}.`;
  }

  return (
    <div className="space-y-6">
      {problems.length > 0 && (
        <div role="status" className="rounded-2xl bg-amber-50 p-4 sm:p-5">
          <p className="flex items-center gap-2 font-semibold text-amber-900">
            <TriangleAlert aria-hidden="true" className="h-5 w-5" />
            {problems.length === 1 ? "En färgkombination är svår att läsa" : `${problems.length} färgkombinationer är svåra att läsa`}
          </p>
          <p className="mt-1 text-[14px] text-amber-900/80">Text behöver tydlig kontrast mot sin bakgrund (WCAG AA), annars blir den svårläst – särskilt i solljus och för personer med nedsatt syn.</p>
          <ul className="mt-3 space-y-2">
            {problems.map((problem) => (
              <li key={`${problem.text}-${problem.background}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2">
                <span className="flex items-center gap-2.5 text-[14px] text-amber-950">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-11 items-center justify-center rounded-lg text-[13px] font-bold ring-1 ring-black/10"
                    style={{ background: colors[problem.background], color: colors[problem.text] }}
                  >
                    Aa
                  </span>
                  <span>
                    <strong className="font-semibold">{colorRoleLabels[problem.text].label}</strong> på {colorRoleLabels[problem.background].label.toLowerCase()}:{" "}
                    {problem.ratio.toFixed(1).replace(".", ",")}:1 (behöver {String(problem.required).replace(".", ",")}:1)
                  </span>
                </span>
                <AdminButton
                  size="sm"
                  icon={Wand2}
                  onClick={() => store.setColor("site", problem.text, fixContrast(colors[problem.text], colors[problem.background], problem.required))}
                >
                  Justera texten
                </AdminButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader title="Färdiga paletter" description="Ett klick byter alla färger. Du kan ångra, och justera enskilda färger efteråt." />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {palettes.map((palette) => {
            const active = colorRoles.every((role) => palette.colors[role].toUpperCase() === colors[role].toUpperCase());
            return (
              <li key={palette.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    store.setColors("site", palette.colors);
                    toast.success(`Paletten ”${palette.name}” är vald.`);
                  }}
                  className={`w-full overflow-hidden rounded-xl bg-white text-left ring-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
                    active ? "ring-2 ring-admin" : "ring-admin-line hover:ring-stone-300"
                  }`}
                >
                  <span aria-hidden="true" className="flex h-12">
                    {(["primary", "secondary", "background", "surface", "text"] as const).map((role) => (
                      <span key={role} className="flex-1" style={{ background: palette.colors[role] }} />
                    ))}
                  </span>
                  <span className="flex min-h-11 items-center justify-between gap-2 px-3 text-[14px] font-semibold text-admin-ink">
                    {palette.name}
                    {active && <Check aria-label="Vald" className="h-4 w-4 text-admin" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {groups.map((group) => (
        <Card key={group}>
          <CardHeader title={group} />
          <div className="divide-y divide-admin-line">
            {colorRoles
              .filter((role) => colorRoleLabels[role].group === group)
              .map((role) => (
                <ColorInput
                  key={role}
                  label={colorRoleLabels[role].label}
                  hint={colorRoleLabels[role].hint}
                  value={colors[role]}
                  warning={warningFor(role)}
                  onChange={(hex) => store.setColor("site", role, hex)}
                />
              ))}
          </div>
        </Card>
      ))}

      <Card className="ring-1 ring-admin/20">
        <CardHeader
          title="Adminpanelens färg"
          description="Färgen på knappar och den markerade menyraden här i adminpanelen. Den påverkar inte hemsidan och sparas direkt."
        />
        <ColorInput
          label="Adminpanelens färg"
          value={prime}
          onChange={(hex) => store.setColor("admin", "primary", hex)}
          warning={contrastRatio(prime, "#FFFFFF") < 3 ? "Ljusa färger gör text och ikoner i den färgen svårlästa." : undefined}
        />
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Förslag">
          {primeSuggestions.map((suggestion) => (
            <button
              key={suggestion.hex}
              type="button"
              aria-pressed={prime.toUpperCase() === suggestion.hex.toUpperCase()}
              onClick={() => store.setColor("admin", "primary", suggestion.hex)}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-[13px] font-semibold text-admin-ink ring-1 ring-admin-line hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin aria-pressed:ring-2 aria-pressed:ring-admin"
            >
              <span aria-hidden="true" className="h-5 w-5 rounded-md" style={{ background: suggestion.hex }} />
              {suggestion.name}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
