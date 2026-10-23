"use client";

import { useState } from "react";
import { ImageOff, Replace, Trash2 } from "lucide-react";
import { AdminButton } from "../ui/Button";
import { TextField } from "../ui/Field";
import { FieldGroup } from "../ui/FieldGroup";
import { ImagePicker } from "../images/ImagePicker";
import { thumbnail, parseFocus } from "@/lib/admin/images";
import type { SiteImage } from "@/lib/site/schema.ts";

/** An image on the site: what it shows, its alt text, the part that must stay in view, and a way to replace it. */
export function ImageField({
  label,
  value,
  usage,
  optional = false,
  onChange,
}: {
  label: string;
  value: SiteImage | null;
  usage?: string;
  optional?: boolean;
  onChange: (image: SiteImage | null) => void;
}) {
  const [picking, setPicking] = useState(false);
  const focus = parseFocus(value?.focus);

  return (
    <FieldGroup label={label}>
      {value ? (
        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div>
            <button
              type="button"
              className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
              aria-label={`Fokuspunkt i bilden: tryck för att flytta den. Nu ${Math.round(focus.x)} % från vänster och ${Math.round(focus.y)} % uppifrån.`}
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - box.left) / box.width) * 100;
                const y = ((event.clientY - box.top) / box.height) * 100;
                onChange({ ...value, focus: `${Math.round(x)}% ${Math.round(y)}%` });
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbnail(value)} alt="" className="h-full w-full object-cover" style={{ objectPosition: value.focus ?? "50% 50%" }} />
              {value.focus && (
                <span
                  aria-hidden="true"
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-admin/70 shadow"
                  style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
                />
              )}
            </button>
            <p className="mt-1.5 text-[12px] leading-snug text-admin-subtle">Tryck i bilden för att välja vad som alltid ska synas.</p>
          </div>
          <div className="space-y-3">
            {/* A browser-tab icon is never read out, so it needs no description. */}
            {usage !== "favicon" && (
              <TextField
                label="Bildtext (alt-text)"
                recommended={125}
                value={value.alt}
                onChange={(alt) => onChange({ ...value, alt })}
                hint={value.alt ? undefined : "Beskriv kort vad bilden visar – för synskadade och för Google."}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <AdminButton size="sm" icon={Replace} onClick={() => setPicking(true)}>
                Byt bild
              </AdminButton>
              {optional && (
                <AdminButton size="sm" variant="ghost" icon={Trash2} onClick={() => onChange(null)}>
                  Ta bort bilden
                </AdminButton>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-200 text-stone-500">
            <ImageOff aria-hidden="true" className="h-5 w-5" />
          </span>
          <AdminButton size="sm" onClick={() => setPicking(true)}>
            Lägg till bild
          </AdminButton>
        </div>
      )}
      <ImagePicker open={picking} onClose={() => setPicking(false)} usage={usage} onSelect={(image) => onChange(image)} />
    </FieldGroup>
  );
}
