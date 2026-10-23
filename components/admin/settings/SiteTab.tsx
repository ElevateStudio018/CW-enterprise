"use client";

import { useState } from "react";
import { Card, CardHeader } from "../ui/Card";
import { SkeletonLines } from "../ui/Skeleton";
import { FieldList } from "../editor/FieldEditor";
import { ImageField } from "../editor/ImageField";
import { ImagePicker } from "../images/ImagePicker";
import { Wordmark } from "@/components/Wordmark";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { rootFields } from "@/lib/site/labels.ts";

/** The logo, then the site's name, address, icon, statistics and maintenance mode. */
export function SiteTab() {
  const { draft, store } = useDraft();
  const [picking, setPicking] = useState(false);
  if (!draft) return <SkeletonLines lines={6} />;
  const { logo } = draft.settings;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Logga" description="Visas i menyraden, i menyn och i sidfoten." />
        <div role="radiogroup" aria-label="Vilken logga" className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["wordmark", "CW Enterprise som text", "Företagsnamnet i rubriktypsnittet, som på den tidigare hemsidan."],
              ["image", "Egen bild", "En logga du laddar upp, t.ex. en PNG med genomskinlig bakgrund."],
            ] as const
          ).map(([kind, label, hint]) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={logo.kind === kind}
              onClick={() => {
                if (kind === "wordmark") store.edit(["settings", "logo"], { kind: "wordmark" });
                else if (logo.kind !== "image") setPicking(true);
              }}
              className={`rounded-xl p-4 text-left ring-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
                logo.kind === kind ? "bg-admin/[0.06] ring-2 ring-admin" : "bg-white ring-admin-line hover:bg-stone-50"
              }`}
            >
              <span className="block text-[15px] font-semibold text-admin-ink">{label}</span>
              <span className="mt-0.5 block text-[13px] text-admin-muted">{hint}</span>
            </button>
          ))}
        </div>
        {logo.kind === "image" && (
          <div className="mt-4">
            <ImageField
              label="Loggans bild"
              value={logo.image}
              usage="logo"
              onChange={(image) => store.edit(["settings", "logo"], image ? { kind: "image", image } : { kind: "wordmark" })}
            />
          </div>
        )}
        <div className="mt-4 rounded-xl px-5 py-4" style={{ background: draft.theme.colors.navigation, color: draft.theme.colors.navigationText }}>
          <p className="mb-2 text-[13px] font-semibold opacity-75">Så här ser den ut i menyraden</p>
          <Wordmark content={{ logo, name: draft.company.shortName }} />
        </div>
        <ImagePicker
          open={picking}
          onClose={() => setPicking(false)}
          usage="logo"
          title="Välj logga"
          onSelect={(image) => store.edit(["settings", "logo"], { kind: "image", image })}
        />
      </Card>

      <Card>
        <CardHeader title="Hemsidan" description="Namn, adress, ikon, statistik och underhållsläge. Ändringarna syns när du publicerar." />
        <FieldList fields={rootFields.settings} base={["settings"]} object={draft.settings as unknown as Record<string, unknown>} draft={draft} />
        <p className="mt-5 text-[14px] text-admin-muted">
          Språk: <strong className="font-semibold text-admin-ink">Svenska</strong>
        </p>
      </Card>
    </div>
  );
}
