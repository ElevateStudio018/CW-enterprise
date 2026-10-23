// The site's whole content as one document: every text, colour, font, image and link the public site shows. The
// public site is rendered from it, the admin edits it and the AI's change sets are checked against it. Shared with the
// Edge Functions (see scripts/sync-shared.mjs), so it imports nothing but zod and its own siblings.
import { z } from "zod";

// ---------------------------------------------------------------------------------------------------------------------
// Building blocks

/** Ids of items in a collection, and so parts of a content path: no dots, no spaces. */
export const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "Ogiltigt id");

const text = (max: number) => z.string().max(max);
export const lineText = text(300);
export const longText = text(4000);

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ange en färg som #RRGGBB");

/**
 * A link target: a page on the site ("/om-oss", "/#kontakt"), a part of the current page ("#faq"), the quote form
 * ("#offert"), or a web, mail or phone address. Script and data addresses are never accepted.
 */
export const hrefSchema = z
  .string()
  .max(500)
  .regex(/^(\/[^\s]*|#[A-Za-z0-9_-]*|https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\s()-]+)$/, "Ogiltig länk");

export { QUOTE_HREF } from "./links.ts";

export const linkSchema = z.object({ label: text(120), href: hrefSchema });
export type Link = z.infer<typeof linkSchema>;

const imageSrcSchema = z
  .string()
  .max(1000)
  .regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, "Ogiltig bildadress");

export const imageSchema = z.object({
  src: imageSrcSchema,
  /** Smaller copies for the browser to choose from (srcset); may be empty. */
  variants: z.array(z.object({ width: z.number().int().positive(), src: imageSrcSchema })).max(12),
  alt: text(300),
  /** Part of the photo to keep when it is cropped (CSS object-position). Left out: the layout's own default. */
  focus: z
    .string()
    .regex(/^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/)
    .optional(),
  /** The uploaded image (website_images.id) this came from, when it came from the image manager. */
  imageId: z.string().max(64).optional(),
});
export type SiteImage = z.infer<typeof imageSchema>;

/** Icons the content may use; components/Icon.tsx draws each of them. */
export const contentIcons = [
  "HardHat",
  "Layers",
  "Shovel",
  "Droplets",
  "Waves",
  "Route",
  "LayoutGrid",
  "Home",
  "Phone",
  "Mail",
  "MapPin",
  "FileText",
  "BadgeCheck",
  "Wrench",
  "Truck",
  "Hammer",
  "Ruler",
  "Clock",
  "ShieldCheck",
  "Leaf",
  "Mountain",
  "Building2",
  "Users",
  "Handshake",
  "ThumbsUp",
  "Star",
  "Calendar",
  "Zap",
  "TreePine",
  "Fence",
] as const;
export const contentIconSchema = z.enum(contentIcons);
export type ContentIcon = z.infer<typeof contentIconSchema>;

/**
 * An ordered list of items with stable ids: `order` holds the ids in display order, `items` the items by id. Every
 * part of an item so has a fixed address (path) however the list is reordered, which is what field-level saving needs.
 */
export function collectionSchema<T extends z.ZodType>(item: T, max = 100) {
  return z
    .object({ order: z.array(idSchema).max(max), items: z.record(idSchema, item) })
    .refine(
      (c) =>
        new Set(c.order).size === c.order.length &&
        c.order.length === Object.keys(c.items).length &&
        c.order.every((id) => Object.prototype.hasOwnProperty.call(c.items, id)),
      "Listans ordning och innehåll stämmer inte överens"
    );
}
export interface Collection<T> {
  order: string[];
  items: Record<string, T>;
}

const seoSchema = z.object({ title: text(120), description: text(320) });

// ---------------------------------------------------------------------------------------------------------------------
// Theme

export const colorRoles = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "heading",
  "muted",
  "subtle",
  "border",
  "input",
  "link",
  "button",
  "buttonHover",
  "buttonText",
  "navigation",
  "navigationText",
  "footer",
  "footerText",
  "onPrimary",
  "success",
  "warning",
  "error",
] as const;
export type ColorRole = (typeof colorRoles)[number];

const fontSchema = z.object({
  family: z.string().regex(/^[A-Za-z0-9 ]{1,60}$/, "Ogiltigt typsnitt"),
  category: z.enum(["sans-serif", "serif", "display", "handwriting", "monospace"]),
});
export type FontChoice = z.infer<typeof fontSchema>;

export const themeSchema = z.object({
  colors: z.object(Object.fromEntries(colorRoles.map((role) => [role, hexColorSchema])) as Record<ColorRole, typeof hexColorSchema>),
  fonts: z.object({ heading: fontSchema, body: fontSchema, button: fontSchema }),
});
export type Theme = z.infer<typeof themeSchema>;

// ---------------------------------------------------------------------------------------------------------------------
// Company and site settings

export const companySchema = z.object({
  legalName: text(120),
  shortName: text(80),
  foundedYear: z.number().int().min(1800).max(2100),
  employees: z.number().int().min(0).max(100000),
  /** The municipality the company is based in. */
  city: text(80),
  serviceArea: text(200),
  address: z.object({
    street: text(120),
    postalCode: text(20),
    city: text(80),
    country: z.string().regex(/^[A-Z]{2}$/),
    geo: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  }),
  phone: text(40),
  email: z.union([z.literal(""), z.email().max(200)]),
  orgNumber: text(20),
  vatNumber: text(30),
  /** Shown with the contact details when set. */
  openingHours: text(200),
  social: z.object({
    facebook: z.union([z.literal(""), z.url().max(300)]),
    instagram: z.union([z.literal(""), z.url().max(300)]),
    linkedin: z.union([z.literal(""), z.url().max(300)]),
  }),
});
export type Company = z.infer<typeof companySchema>;

export const settingsSchema = z.object({
  /** Ends every page title ("Om oss | …") and names the site to search engines and social media. */
  siteName: text(120),
  siteUrl: z.url().max(200),
  language: z.literal("sv"),
  favicon: imageSchema,
  logo: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("wordmark") }),
    z.object({ kind: z.literal("image"), image: imageSchema }),
  ]),
  /** Google Analytics measurement id ("G-…"); empty: no analytics and no cookie question. */
  analyticsId: z.union([z.literal(""), z.string().regex(/^G-[A-Z0-9]{4,20}$/)]),
  maintenance: z.object({ enabled: z.boolean(), heading: lineText, text: longText }),
});
export type Settings = z.infer<typeof settingsSchema>;

// ---------------------------------------------------------------------------------------------------------------------
// Shared lists

const captionedImageSchema = z.object({ image: imageSchema, caption: lineText });

export const serviceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/),
  name: text(80),
  shortDescription: text(400),
  /** The bold first line of the service page's text. */
  lead: longText,
  description: z.array(longText).max(20),
  /** The "what can be included" list beside the text. */
  includes: z.array(lineText).max(20),
  /** Photos from the work, under the text; the heading and link lead to the project. */
  galleryHeading: lineText,
  galleryLink: linkSchema,
  gallery: collectionSchema(captionedImageSchema, 12),
  icon: contentIconSchema,
  image: imageSchema,
  seo: seoSchema,
});
export type Service = z.infer<typeof serviceSchema>;

export const uppdragSchema = z.object({ tag: text(60), title: text(120), text: longText, href: hrefSchema, image: imageSchema });
export type Uppdrag = z.infer<typeof uppdragSchema>;

export const certificateSchema = z.object({
  name: text(160),
  issuer: text(160),
  description: longText,
  validUntil: text(40),
  /** The certificate's badge or logo, shown whole. */
  image: imageSchema.nullable(),
});
export type Certificate = z.infer<typeof certificateSchema>;

// ---------------------------------------------------------------------------------------------------------------------
// Sections. Every page is an ordered list of these; each type has its own component in components/sections.

const sectionBase = {
  hidden: z.boolean(),
  /** The id others link to (/#kontakt); empty for none. */
  anchor: z.string().regex(/^([a-z0-9-]{1,40})?$/),
  /** The name the admin lists the section under; the type's own name when empty. */
  label: text(80),
  /** The small coloured line above the heading; empty for none. */
  eyebrow: lineText,
};

const labelItemSchema = z.object({ label: lineText });
const factSchema = z.object({ label: lineText, value: lineText });

const heroSection = z.object({ type: z.literal("hero"), ...sectionBase, heading: lineText, text: longText, image: imageSchema, button: linkSchema });
const servicesSection = z.object({
  type: z.literal("services"),
  ...sectionBase,
  heading: lineText,
  link: linkSchema,
  cardLinkPrefix: lineText,
  /** A light box after the service cards listing smaller jobs; no heading: no box. */
  moreHeading: lineText,
  moreItems: collectionSchema(labelItemSchema, 20),
  /** A coloured box last in the grid that opens the quote form; no heading: no box. */
  ctaHeading: lineText,
  ctaText: longText,
  ctaButton: linkSchema,
});
const uppdragCarouselSection = z.object({ type: z.literal("uppdragCarousel"), ...sectionBase, heading: lineText, text: longText, link: linkSchema });
const statItemSchema = z.object({
  label: lineText,
  /** "yearsSince": the number of years from `value` (a year) until now, so it keeps itself up to date. */
  valueType: z.enum(["number", "yearsSince"]),
  value: z.number().int().min(0).max(1000000000),
  countUp: z.boolean(),
});
const statsSection = z.object({ type: z.literal("stats"), ...sectionBase, heading: lineText, items: collectionSchema(statItemSchema, 8) });
const featureCardSchema = z.object({ heading: lineText, text: longText, icon: contentIconSchema, link: linkSchema, image: imageSchema });
const featureSection = z.object({
  type: z.literal("feature"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  image: imageSchema,
  cards: collectionSchema(featureCardSchema, 4),
});
const promoBoxSchema = z.object({ side: z.enum(["left", "right"]), heading: lineText, text: longText, link: linkSchema, image: imageSchema });
const promoSection = z.object({ type: z.literal("promo"), ...sectionBase, boxes: collectionSchema(promoBoxSchema, 6) });
const aboutSection = z.object({
  type: z.literal("about"),
  ...sectionBase,
  heading: lineText,
  link: linkSchema,
  subheading: longText,
  text: longText,
  image: imageSchema,
  facts: collectionSchema(factSchema, 12),
  /** The round badge on the photo, e.g. "5/5" over "i omdömen"; no value: no badge. */
  badgeValue: lineText,
  badgeLabel: lineText,
});
const processStepSchema = z.object({ title: lineText, description: longText, icon: contentIconSchema });
const processSection = z.object({ type: z.literal("process"), ...sectionBase, heading: lineText, text: longText, steps: collectionSchema(processStepSchema, 8) });
const faqItemSchema = z.object({ question: lineText, answer: longText });
const faqSection = z.object({
  type: z.literal("faq"),
  ...sectionBase,
  heading: lineText,
  /** Followed by the phone number as a link; empty: no phone line. */
  phonePrompt: lineText,
  items: collectionSchema(faqItemSchema, 40),
});
const contactSection = z.object({
  type: z.literal("contact"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  phoneLabel: lineText,
  emailLabel: lineText,
  addressLabel: lineText,
  openingHoursLabel: lineText,
  orgLabel: lineText,
  formHeading: lineText,
});
const mapSection = z.object({
  type: z.literal("map"),
  ...sectionBase,
  heading: lineText,
  addressPrefix: lineText,
  linkLabel: lineText,
  zoom: z.number().int().min(3).max(20),
});
const pageHeroSection = z.object({
  type: z.literal("pageHero"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  button: linkSchema,
  image: imageSchema,
  size: z.enum(["tall", "medium"]),
});
const aboutIntroSection = z.object({
  type: z.literal("aboutIntro"),
  ...sectionBase,
  heading: lineText,
  subheading: longText,
  paragraphs: z.array(longText).max(20),
  factsTitle: lineText,
  facts: collectionSchema(factSchema, 12),
});
const photoPairSection = z.object({ type: z.literal("photoPair"), ...sectionBase, photos: collectionSchema(z.object({ image: imageSchema }), 2) });
const bandSection = z.object({
  type: z.literal("band"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  link: linkSchema,
  image: imageSchema,
  secondHeading: lineText,
  secondText: longText,
  secondLink: linkSchema,
});
const certificatesSection = z.object({
  type: z.literal("certificates"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  issuerPrefix: lineText,
  validUntilPrefix: lineText,
  emptyHeading: lineText,
  /** Followed by the phone number as a link. */
  emptyText: longText,
});
const uppdragGridSection = z.object({ type: z.literal("uppdragGrid"), ...sectionBase, heading: lineText, text: longText, filterAllLabel: lineText });
const ctaSection = z.object({ type: z.literal("cta"), ...sectionBase, heading: lineText, text: longText, button: linkSchema });
const teamMemberSchema = z.object({
  name: lineText,
  role: lineText,
  phone: lineText,
  email: z.union([z.literal(""), z.email().max(200)]),
  image: imageSchema.nullable(),
});
const teamSection = z.object({ type: z.literal("team"), ...sectionBase, heading: lineText, text: longText, members: collectionSchema(teamMemberSchema, 40) });
const gallerySection = z.object({
  type: z.literal("gallery"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  link: linkSchema,
  images: collectionSchema(captionedImageSchema, 60),
});
const priceRowSchema = z.object({ name: lineText, description: longText, price: lineText });
const pricelistSection = z.object({
  type: z.literal("pricelist"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  rows: collectionSchema(priceRowSchema, 60),
  note: longText,
});
const testimonialSchema = z.object({
  /** What the job was, shown small above the quote. */
  title: lineText,
  quote: longText,
  name: lineText,
  detail: lineText,
  /** 1–5 stars, or 0 for none. */
  rating: z.number().int().min(0).max(5),
  image: imageSchema.nullable(),
});
const testimonialsSection = z.object({ type: z.literal("testimonials"), ...sectionBase, heading: lineText, text: longText, items: collectionSchema(testimonialSchema, 40) });
const textSection = z.object({
  type: z.literal("text"),
  ...sectionBase,
  heading: lineText,
  paragraphs: z.array(longText).max(20),
  image: imageSchema.nullable(),
  imageSide: z.enum(["left", "right"]),
  button: linkSchema.nullable(),
  tone: z.enum(["light", "card", "primary"]),
});

const overlaySection = z.object({
  type: z.literal("overlay"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  chips: collectionSchema(labelItemSchema, 10),
  link: linkSchema,
  image: imageSchema,
});
const beforeAfterSection = z.object({
  type: z.literal("beforeAfter"),
  ...sectionBase,
  heading: lineText,
  link: linkSchema,
  beforeLabel: lineText,
  before: imageSchema,
  afterLabel: lineText,
  after: imageSchema,
});
const valuesSection = z.object({
  type: z.literal("values"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  items: collectionSchema(z.object({ heading: lineText, text: longText, icon: contentIconSchema }), 6),
});
const areaSection = z.object({
  type: z.literal("area"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  places: collectionSchema(labelItemSchema, 30),
  link: linkSchema,
  /** What the map shows, as typed into Google Maps. */
  mapQuery: lineText,
});

/** A month as "2025-06"; empty while a new item is being written. */
const monthSchema = z.string().regex(/^(\d{4}-(0[1-9]|1[0-2]))?$/, "Ange månaden som ÅÅÅÅ-MM");
const timelineSection = z.object({
  type: z.literal("timeline"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  /** Assignments drawn as bars on a month scale, from the first start to the last end. */
  items: collectionSchema(z.object({ title: lineText, text: longText, start: monthSchema, end: monthSchema }), 12),
});
const modelSection = z.object({
  type: z.literal("model"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  /** Which 3D model to draw (components/sections/model/scenes.ts). */
  model: z.enum(["koncern", "system", "building", "frame"]),
  caption: lineText,
  /** Labels on the model's parts, in order; on the group model also the colour each part lights up in. */
  parts: collectionSchema(z.object({ label: lineText, color: z.string().regex(/^(#[0-9a-fA-F]{6})?$/, "Ange en färg som #RRGGBB") }), 4),
});

export const sectionSchema = z.discriminatedUnion("type", [
  heroSection,
  servicesSection,
  uppdragCarouselSection,
  statsSection,
  featureSection,
  promoSection,
  aboutSection,
  processSection,
  faqSection,
  contactSection,
  mapSection,
  pageHeroSection,
  aboutIntroSection,
  photoPairSection,
  bandSection,
  certificatesSection,
  uppdragGridSection,
  ctaSection,
  teamSection,
  gallerySection,
  pricelistSection,
  testimonialsSection,
  textSection,
  overlaySection,
  beforeAfterSection,
  valuesSection,
  areaSection,
  timelineSection,
  modelSection,
]);
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

export const pageSchema = z.object({
  /** The page's address: "" for the start page, otherwise one word or several joined by hyphens. */
  slug: z.string().regex(/^([a-z0-9][a-z0-9-]{0,60})?$/),
  /** Its name in breadcrumbs and in the admin. */
  title: lineText,
  seo: seoSchema,
  sections: collectionSchema(sectionSchema, 40),
});
export type Page = z.infer<typeof pageSchema>;

// ---------------------------------------------------------------------------------------------------------------------
// Navigation, footer, form and the remaining interface texts

export const navigationSchema = z.object({
  /** The links in the bar on wide screens. */
  barLinks: collectionSchema(linkSchema, 8),
  /** The rows of the full-screen menu; "services" lists every service under its label. */
  menu: collectionSchema(z.object({ label: lineText, href: hrefSchema, kind: z.enum(["link", "services"]) }), 12),
  menuButton: lineText,
});

export const footerSchema = z.object({
  contactHeading: lineText,
  servicesHeading: lineText,
  companyHeading: lineText,
  companyLinks: collectionSchema(linkSchema, 12),
  button: linkSchema,
  copyrightName: lineText,
  orgLabel: lineText,
  vatLabel: lineText,
});

export const formSchema = z.object({
  modalHeading: lineText,
  labels: z.object({ name: lineText, phone: lineText, email: lineText, workType: lineText, description: lineText }),
  workTypePlaceholder: lineText,
  descriptionPlaceholder: lineText,
  workTypes: collectionSchema(z.object({ label: lineText }), 20),
  contactHint: lineText,
  errors: z.object({ name: lineText, contact: lineText, phone: lineText, email: lineText, workType: lineText }),
  submit: lineText,
  sending: lineText,
  /** Followed by the phone number as a link. */
  sendFailed: lineText,
  /** Followed by a button that closes the window. */
  closeHint: lineText,
  closeHintButton: lineText,
  confirmation: lineText,
  /** The subject of the e-mail the company gets; {namn} is replaced by the sender's name. */
  emailSubject: lineText,
});

export const servicePageSchema = z.object({
  badge: lineText,
  /** The small line above the service's name at the top of its page. */
  eyebrow: lineText,
  includesHeading: lineText,
  galleryEyebrow: lineText,
  reviewsEyebrow: lineText,
  reviewsHeading: lineText,
  moreEyebrow: lineText,
  cta: z.object({ heading: lineText, text: longText, button: linkSchema }),
  factsTitle: lineText,
  factLabels: z.object({ service: lineText, performedBy: lineText, seat: lineText, area: lineText, org: lineText }),
  contactTagline: lineText,
  contactButton: linkSchema,
  backLink: linkSchema,
  moreHeading: lineText,
  breadcrumbLabel: lineText,
  breadcrumbHref: hrefSchema,
});

export const uiSchema = z.object({
  skipLink: lineText,
  openMenu: lineText,
  closeMenu: lineText,
  menuLabel: lineText,
  mainMenuLabel: lineText,
  quickLinksLabel: lineText,
  /** Read out before the phone number on the call button. */
  callPrefix: lineText,
  homeLinkLabel: lineText,
  breadcrumbsLabel: lineText,
  breadcrumbHome: lineText,
  carouselPrevious: lineText,
  carouselNext: lineText,
  /** {n} and {total} are replaced by the position and the number of positions. */
  carouselGoTo: lineText,
  uppdragFilterLabel: lineText,
  stepPrefix: lineText,
  mapTitlePrefix: lineText,
  closeLabel: lineText,
  /** {n} is replaced by the number of stars. */
  ratingLabel: lineText,
  cookieText: longText,
  cookieAccept: lineText,
  cookieDecline: lineText,
  /** The footer's button for changing one's answer; the button is left out while this is unset. */
  cookieSettings: lineText.optional(),
});

export const notFoundSchema = z.object({ eyebrow: lineText, heading: lineText, text: longText, button: linkSchema, seoTitle: lineText });

export const siteDataSchema = z.object({
  schemaVersion: z.literal(1),
  theme: themeSchema,
  settings: settingsSchema,
  company: companySchema,
  navigation: navigationSchema,
  footer: footerSchema,
  form: formSchema,
  ui: uiSchema,
  servicePage: servicePageSchema,
  notFound: notFoundSchema,
  services: collectionSchema(serviceSchema, 40),
  uppdrag: collectionSchema(uppdragSchema, 60),
  certificates: collectionSchema(certificateSchema, 60),
  pages: collectionSchema(pageSchema, 30),
});
export type SiteData = z.infer<typeof siteDataSchema>;

/** The top-level parts of the document, in the order the admin lists them. */
export const SITE_ROOT_KEYS = Object.keys(siteDataSchema.shape) as (keyof SiteData)[];
