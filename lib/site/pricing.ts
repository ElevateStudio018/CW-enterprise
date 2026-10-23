// What AI changes cost in credits. The admin shows the table under "Så fungerar credits"; the AI function prices each
// change set from it (deterministically, from what the change set contains, never from what the model says).
// Manual editing is always free.

export const PRICES = {
  advice: 0,
  minorText: 1,
  theme: 2,
  rewriteSection: 3,
  element: 5,
  layout: 8,
  seo: 8,
  standardSection: 15,
  advancedSection: 20,
  page: 30,
} as const;

export type PriceKey = keyof typeof PRICES;

/** Each price as one line of a breakdown ("Ny avancerad sektion (20)"). */
export const priceLabels: Record<PriceKey, string> = {
  advice: "Råd utan ändring",
  minorText: "Mindre textjustering",
  theme: "Färger eller typsnitt",
  rewriteSection: "Omskriven sektionstext",
  element: "Element som läggs till eller tas bort",
  layout: "Ombyggd layout i en sektion",
  seo: "SEO-optimering av en sida",
  standardSection: "Ny standardsektion",
  advancedSection: "Ny avancerad sektion",
  page: "Ny undersida",
};

/** The table exactly as the owner sees it. */
export const priceTable: { action: string; credits: string }[] = [
  { action: "Manuella ändringar i adminpanelen", credits: "0 (alltid gratis)" },
  { action: "Fråga AI:n om råd, utan ändring", credits: "0" },
  { action: "Mindre textjustering (rubrik, knapptext, en mening)", credits: "1" },
  { action: "Skriva om en hel sektions text", credits: "3" },
  { action: "Ändra färger, typsnitt eller avstånd via AI", credits: "2" },
  { action: "Lägga till/ta bort ett enskilt element (FAQ-fråga, tjänstekort, statistik)", credits: "5" },
  { action: "Bygga om layouten i en befintlig sektion", credits: "8" },
  { action: "SEO-optimering av en sida (titel, meta, rubrikstruktur)", credits: "8" },
  { action: "Ny standardsektion (om oss, CTA, FAQ, statistik, kontakt)", credits: "15" },
  { action: "Ny avancerad sektion (team, galleri, prislista, recensioner med bilder)", credits: "20" },
  { action: "Flera sektioner i samma uppdrag", credits: "Summan av varje sektion" },
  { action: "Ny undersida", credits: "30" },
  { action: "Misslyckad eller avbruten generering", credits: "0 (dras aldrig)" },
  { action: "Återställning av en tidigare version", credits: "0" },
];

/** At or below this balance the admin shows a gentle warning. */
export const LOW_CREDITS = 20;
