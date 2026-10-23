"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Dialog } from "../ui/Dialog";
import { contentIcons, type ContentIcon } from "@/lib/site/schema.ts";

const iconNames: Record<ContentIcon, string> = {
  HardHat: "Skyddshjälm",
  Layers: "Lager",
  Shovel: "Spade",
  Droplets: "Droppar",
  Waves: "Vågor",
  Route: "Väg",
  LayoutGrid: "Plattor",
  Home: "Hus",
  Phone: "Telefon",
  Mail: "E-post",
  MapPin: "Plats",
  FileText: "Dokument",
  BadgeCheck: "Certifierad",
  Wrench: "Verktyg",
  Truck: "Lastbil",
  Hammer: "Hammare",
  Ruler: "Linjal",
  Clock: "Klocka",
  ShieldCheck: "Trygghet",
  Leaf: "Löv",
  Mountain: "Berg",
  Building2: "Byggnad",
  Users: "Personer",
  Handshake: "Handslag",
  ThumbsUp: "Tumme upp",
  Star: "Stjärna",
  Calendar: "Kalender",
  Zap: "Blixt",
  TreePine: "Träd",
  Fence: "Staket",
};

export function IconPicker({ label, value, onChange, hint }: { label: string; value: ContentIcon; onChange: (icon: ContentIcon) => void; hint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-[14px] font-semibold text-admin-ink">{label}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 text-[14px] text-admin-ink ring-1 ring-inset ring-admin-line hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-admin text-admin-contrast">
          <Icon name={value} className="h-[18px] w-[18px]" />
        </span>
        {iconNames[value]} <span className="text-admin-muted">– byt</span>
      </button>
      {hint && <p className="mt-1.5 text-[13px] text-admin-muted">{hint}</p>}
      <Dialog open={open} onClose={() => setOpen(false)} title="Välj symbol" size="md">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {contentIcons.map((icon) => (
            <li key={icon}>
              <button
                type="button"
                onClick={() => {
                  onChange(icon);
                  setOpen(false);
                }}
                aria-pressed={icon === value}
                className={`flex w-full flex-col items-center gap-1.5 rounded-xl p-3 text-[12px] ring-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
                  icon === value ? "bg-admin text-admin-contrast ring-admin" : "bg-white text-admin-ink ring-admin-line hover:bg-stone-50"
                }`}
              >
                <Icon name={icon} className="h-6 w-6" />
                {iconNames[icon]}
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
