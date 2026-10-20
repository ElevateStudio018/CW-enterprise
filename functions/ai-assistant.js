// supabase/functions/ai-assistant/index.ts
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { z as z3 } from "npm:zod@4.6.5";

// supabase/functions/_shared/env.ts
function env(name, fallback) {
  const value = Deno.env.get(name) ?? fallback;
  if (value === void 0 || value === "") throw new Error(`Missing setting ${name}`);
  return value;
}
function optionalEnv(name) {
  const value = Deno.env.get(name);
  return value === void 0 || value === "" ? void 0 : value;
}
var config = {
  supabaseUrl: () => env("SUPABASE_URL"),
  anonKey: () => env("SUPABASE_ANON_KEY"),
  serviceRoleKey: () => env("SUPABASE_SERVICE_ROLE_KEY"),
  /** The public site, for links in e-mails. */
  siteUrl: () => env("SITE_URL", "https://elevatestudio018.github.io/CW-enterprise"),
  /** The admin panel, for links in e-mails. */
  adminUrl: () => env("ADMIN_URL", `${env("SITE_URL", "https://elevatestudio018.github.io/CW-enterprise")}/admin`),
  /** Elevate Studio, who approve resets, receive credit orders and the staff's suggestions, and quote requests until launch. */
  agencyEmail: () => env("AGENCY_EMAIL", "elevate.studio018@gmail.com"),
  /** A secret for one purpose: its own setting when there is one, otherwise derived from the service role key, so a new
   * project needs no extra random strings made up for it. */
  secret: (name, purpose) => optionalEnv(name) ?? `${purpose}:${env("SUPABASE_SERVICE_ROLE_KEY")}`,
  /** Browsers allowed to call the functions (the site and admin's origins), comma-separated. */
  allowedOrigins: () => env("ALLOWED_ORIGINS", "https://elevatestudio018.github.io,http://localhost:3000,http://localhost:3130,http://localhost:3132,http://127.0.0.1:3000").split(",").map((origin) => origin.trim())
};

// supabase/functions/_shared/http.ts
function corsHeaders(request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = config.allowedOrigins().includes(origin);
  return {
    ...allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {},
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-id",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400"
  };
}
function json(request, body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request), ...extra }
  });
}
var UserError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
function handle(handler) {
  return async (request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof UserError) return json(request, { error: error.code, message: error.message }, error.status);
      console.error(error);
      return json(request, { error: "server_error", message: "N\xE5got gick fel hos oss. F\xF6rs\xF6k igen om en stund." }, 500);
    }
  };
}
async function readJson(request, maxBytes = 2e6) {
  const text3 = await request.text();
  if (text3.length > maxBytes) throw new UserError(413, "too_large", "Det du skickade var f\xF6r stort.");
  try {
    return JSON.parse(text3);
  } catch {
    throw new UserError(400, "bad_request", "Ogiltig f\xF6rfr\xE5gan.");
  }
}

// supabase/functions/_shared/supabase.ts
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
function serviceClient() {
  return createClient(config.supabaseUrl(), config.serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
function userClient(request) {
  return createClient(config.supabaseUrl(), config.anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } }
  });
}
async function requireAdmin(request) {
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new UserError(401, "not_signed_in", "Du \xE4r inte inloggad.");
  const service = serviceClient();
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) throw new UserError(401, "not_signed_in", "Din inloggning har g\xE5tt ut. Logga in igen.");
  const { data: profile } = await service.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") throw new UserError(403, "not_admin", "Kontot har inte beh\xF6righet till adminpanelen.");
  return { user: data.user, client: userClient(request) };
}
async function audit(action, entity, before, after, actor, ip = "") {
  await serviceClient().from("audit_log").insert({ action, entity, before, after, actor, ip });
}

// supabase/functions/_shared/deploy.ts
async function triggerDeploy(version) {
  const token = optionalEnv("GITHUB_DISPATCH_TOKEN");
  const service = serviceClient();
  const record = (value) => service.from("settings").upsert({ key: "deploy", value: { ...value, version, at: (/* @__PURE__ */ new Date()).toISOString() }, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  if (!token) {
    await record({ status: "not_configured" });
    return { started: false, message: "Uppdateringen av hemsidan \xE4r inte kopplad \xE4n (GITHUB_DISPATCH_TOKEN saknas)." };
  }
  const repository = env("GITHUB_REPOSITORY", "ElevateStudio018/CW-enterprise");
  const workflow = env("GITHUB_WORKFLOW", "deploy-pages.yml");
  const ref = env("GITHUB_REF", "claude/ny-webbplats");
  const api = env("GITHUB_API_URL", "https://api.github.com");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${api}/repos/${repository}/actions/workflows/${workflow}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "cw-enterprise-admin"
        },
        body: JSON.stringify({ ref })
      });
      if (response.status === 204) {
        await record({ status: "started" });
        return { started: true };
      }
      console.error("GitHub refused the deploy:", response.status, await response.text());
      if (response.status < 500) break;
    } catch (error) {
      console.error("Could not reach GitHub:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1e3));
  }
  await record({ status: "failed" });
  return { started: false, message: "\xC4ndringen \xE4r sparad, men hemsidan kunde inte uppdateras just nu. F\xF6rs\xF6k igen om en stund." };
}

// supabase/functions/_shared/site/changeset.ts
import { z as z2 } from "npm:zod@4.6.5";

// supabase/functions/_shared/site/schema.ts
import { z } from "npm:zod@4.6.5";
var idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "Ogiltigt id");
var text = (max) => z.string().max(max);
var lineText = text(300);
var longText = text(4e3);
var hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ange en f\xE4rg som #RRGGBB");
var hrefSchema = z.string().max(500).regex(/^(\/[^\s]*|#[A-Za-z0-9_-]*|https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\s()-]+)$/, "Ogiltig l\xE4nk");
var linkSchema = z.object({ label: text(120), href: hrefSchema });
var imageSrcSchema = z.string().max(1e3).regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, "Ogiltig bildadress");
var imageSchema = z.object({
  src: imageSrcSchema,
  /** Smaller copies for the browser to choose from (srcset); may be empty. */
  variants: z.array(z.object({ width: z.number().int().positive(), src: imageSrcSchema })).max(12),
  alt: text(300),
  /** Part of the photo to keep when it is cropped (CSS object-position). Left out: the layout's own default. */
  focus: z.string().regex(/^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/).optional(),
  /** The uploaded image (website_images.id) this came from, when it came from the image manager. */
  imageId: z.string().max(64).optional()
});
var contentIcons = [
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
  "Fence"
];
var contentIconSchema = z.enum(contentIcons);
function collectionSchema(item, max = 100) {
  return z.object({ order: z.array(idSchema).max(max), items: z.record(idSchema, item) }).refine(
    (c) => new Set(c.order).size === c.order.length && c.order.length === Object.keys(c.items).length && c.order.every((id) => Object.prototype.hasOwnProperty.call(c.items, id)),
    "Listans ordning och inneh\xE5ll st\xE4mmer inte \xF6verens"
  );
}
var seoSchema = z.object({ title: text(120), description: text(320) });
var colorRoles = [
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
  "error"
];
var fontSchema = z.object({
  family: z.string().regex(/^[A-Za-z0-9 ]{1,60}$/, "Ogiltigt typsnitt"),
  category: z.enum(["sans-serif", "serif", "display", "handwriting", "monospace"])
});
var themeSchema = z.object({
  colors: z.object(Object.fromEntries(colorRoles.map((role) => [role, hexColorSchema]))),
  fonts: z.object({ heading: fontSchema, body: fontSchema, button: fontSchema })
});
var companySchema = z.object({
  legalName: text(120),
  shortName: text(80),
  foundedYear: z.number().int().min(1800).max(2100),
  employees: z.number().int().min(0).max(1e5),
  /** The municipality the company is based in. */
  city: text(80),
  serviceArea: text(200),
  address: z.object({
    street: text(120),
    postalCode: text(20),
    city: text(80),
    country: z.string().regex(/^[A-Z]{2}$/),
    geo: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
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
    linkedin: z.union([z.literal(""), z.url().max(300)])
  })
});
var settingsSchema = z.object({
  /** Ends every page title ("Om oss | …") and names the site to search engines and social media. */
  siteName: text(120),
  siteUrl: z.url().max(200),
  language: z.literal("sv"),
  favicon: imageSchema,
  logo: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("wordmark") }),
    z.object({ kind: z.literal("image"), image: imageSchema })
  ]),
  /** Google Analytics measurement id ("G-…"); empty: no analytics and no cookie question. */
  analyticsId: z.union([z.literal(""), z.string().regex(/^G-[A-Z0-9]{4,20}$/)]),
  maintenance: z.object({ enabled: z.boolean(), heading: lineText, text: longText })
});
var captionedImageSchema = z.object({ image: imageSchema, caption: lineText });
var serviceSchema = z.object({
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
  seo: seoSchema
});
var uppdragSchema = z.object({ tag: text(60), title: text(120), text: longText, href: hrefSchema, image: imageSchema });
var certificateSchema = z.object({
  name: text(160),
  issuer: text(160),
  description: longText,
  validUntil: text(40),
  /** The certificate's badge or logo, shown whole. */
  image: imageSchema.nullable()
});
var sectionBase = {
  hidden: z.boolean(),
  /** The id others link to (/#kontakt); empty for none. */
  anchor: z.string().regex(/^([a-z0-9-]{1,40})?$/),
  /** The name the admin lists the section under; the type's own name when empty. */
  label: text(80),
  /** The small coloured line above the heading; empty for none. */
  eyebrow: lineText
};
var labelItemSchema = z.object({ label: lineText });
var factSchema = z.object({ label: lineText, value: lineText });
var heroSection = z.object({ type: z.literal("hero"), ...sectionBase, heading: lineText, text: longText, image: imageSchema, button: linkSchema });
var servicesSection = z.object({
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
  ctaButton: linkSchema
});
var uppdragCarouselSection = z.object({ type: z.literal("uppdragCarousel"), ...sectionBase, heading: lineText, text: longText, link: linkSchema });
var statItemSchema = z.object({
  label: lineText,
  /** "yearsSince": the number of years from `value` (a year) until now, so it keeps itself up to date. */
  valueType: z.enum(["number", "yearsSince"]),
  value: z.number().int().min(0).max(1e9),
  countUp: z.boolean()
});
var statsSection = z.object({ type: z.literal("stats"), ...sectionBase, heading: lineText, items: collectionSchema(statItemSchema, 8) });
var featureCardSchema = z.object({ heading: lineText, text: longText, icon: contentIconSchema, link: linkSchema, image: imageSchema });
var featureSection = z.object({
  type: z.literal("feature"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  image: imageSchema,
  cards: collectionSchema(featureCardSchema, 4)
});
var promoBoxSchema = z.object({ side: z.enum(["left", "right"]), heading: lineText, text: longText, link: linkSchema, image: imageSchema });
var promoSection = z.object({ type: z.literal("promo"), ...sectionBase, boxes: collectionSchema(promoBoxSchema, 6) });
var aboutSection = z.object({
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
  badgeLabel: lineText
});
var processStepSchema = z.object({ title: lineText, description: longText, icon: contentIconSchema });
var processSection = z.object({ type: z.literal("process"), ...sectionBase, heading: lineText, text: longText, steps: collectionSchema(processStepSchema, 8) });
var faqItemSchema = z.object({ question: lineText, answer: longText });
var faqSection = z.object({
  type: z.literal("faq"),
  ...sectionBase,
  heading: lineText,
  /** Followed by the phone number as a link; empty: no phone line. */
  phonePrompt: lineText,
  items: collectionSchema(faqItemSchema, 40)
});
var contactSection = z.object({
  type: z.literal("contact"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  phoneLabel: lineText,
  emailLabel: lineText,
  addressLabel: lineText,
  openingHoursLabel: lineText,
  orgLabel: lineText,
  formHeading: lineText
});
var mapSection = z.object({
  type: z.literal("map"),
  ...sectionBase,
  heading: lineText,
  addressPrefix: lineText,
  linkLabel: lineText,
  zoom: z.number().int().min(3).max(20)
});
var pageHeroSection = z.object({
  type: z.literal("pageHero"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  button: linkSchema,
  image: imageSchema,
  size: z.enum(["tall", "medium"])
});
var aboutIntroSection = z.object({
  type: z.literal("aboutIntro"),
  ...sectionBase,
  heading: lineText,
  subheading: longText,
  paragraphs: z.array(longText).max(20),
  factsTitle: lineText,
  facts: collectionSchema(factSchema, 12)
});
var photoPairSection = z.object({ type: z.literal("photoPair"), ...sectionBase, photos: collectionSchema(z.object({ image: imageSchema }), 2) });
var bandSection = z.object({
  type: z.literal("band"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  link: linkSchema,
  image: imageSchema,
  secondHeading: lineText,
  secondText: longText,
  secondLink: linkSchema
});
var certificatesSection = z.object({
  type: z.literal("certificates"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  issuerPrefix: lineText,
  validUntilPrefix: lineText,
  emptyHeading: lineText,
  /** Followed by the phone number as a link. */
  emptyText: longText
});
var uppdragGridSection = z.object({ type: z.literal("uppdragGrid"), ...sectionBase, heading: lineText, text: longText, filterAllLabel: lineText });
var ctaSection = z.object({ type: z.literal("cta"), ...sectionBase, heading: lineText, text: longText, button: linkSchema });
var teamMemberSchema = z.object({
  name: lineText,
  role: lineText,
  phone: lineText,
  email: z.union([z.literal(""), z.email().max(200)]),
  image: imageSchema.nullable()
});
var teamSection = z.object({ type: z.literal("team"), ...sectionBase, heading: lineText, text: longText, members: collectionSchema(teamMemberSchema, 40) });
var gallerySection = z.object({
  type: z.literal("gallery"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  link: linkSchema,
  images: collectionSchema(captionedImageSchema, 60)
});
var priceRowSchema = z.object({ name: lineText, description: longText, price: lineText });
var pricelistSection = z.object({
  type: z.literal("pricelist"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  rows: collectionSchema(priceRowSchema, 60),
  note: longText
});
var testimonialSchema = z.object({
  /** What the job was, shown small above the quote. */
  title: lineText,
  quote: longText,
  name: lineText,
  detail: lineText,
  /** 1–5 stars, or 0 for none. */
  rating: z.number().int().min(0).max(5),
  image: imageSchema.nullable()
});
var testimonialsSection = z.object({ type: z.literal("testimonials"), ...sectionBase, heading: lineText, text: longText, items: collectionSchema(testimonialSchema, 40) });
var textSection = z.object({
  type: z.literal("text"),
  ...sectionBase,
  heading: lineText,
  paragraphs: z.array(longText).max(20),
  image: imageSchema.nullable(),
  imageSide: z.enum(["left", "right"]),
  button: linkSchema.nullable(),
  tone: z.enum(["light", "card", "primary"])
});
var overlaySection = z.object({
  type: z.literal("overlay"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  chips: collectionSchema(labelItemSchema, 10),
  link: linkSchema,
  image: imageSchema
});
var beforeAfterSection = z.object({
  type: z.literal("beforeAfter"),
  ...sectionBase,
  heading: lineText,
  link: linkSchema,
  beforeLabel: lineText,
  before: imageSchema,
  afterLabel: lineText,
  after: imageSchema
});
var valuesSection = z.object({
  type: z.literal("values"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  items: collectionSchema(z.object({ heading: lineText, text: longText, icon: contentIconSchema }), 6)
});
var areaSection = z.object({
  type: z.literal("area"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  places: collectionSchema(labelItemSchema, 30),
  link: linkSchema,
  /** What the map shows, as typed into Google Maps. */
  mapQuery: lineText
});
var monthSchema = z.string().regex(/^(\d{4}-(0[1-9]|1[0-2]))?$/, "Ange m\xE5naden som \xC5\xC5\xC5\xC5-MM");
var timelineSection = z.object({
  type: z.literal("timeline"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  /** Assignments drawn as bars on a month scale, from the first start to the last end. */
  items: collectionSchema(z.object({ title: lineText, text: longText, start: monthSchema, end: monthSchema }), 12)
});
var modelSection = z.object({
  type: z.literal("model"),
  ...sectionBase,
  heading: lineText,
  text: longText,
  /** Which 3D model to draw (components/sections/model/scenes.ts). */
  model: z.enum(["koncern", "system", "building", "frame"]),
  caption: lineText,
  /** Labels on the model's parts, in order; on the group model also the colour each part lights up in. */
  parts: collectionSchema(z.object({ label: lineText, color: z.string().regex(/^(#[0-9a-fA-F]{6})?$/, "Ange en f\xE4rg som #RRGGBB") }), 4)
});
var sectionSchema = z.discriminatedUnion("type", [
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
  modelSection
]);
var pageSchema = z.object({
  /** The page's address: "" for the start page, otherwise one word or several joined by hyphens. */
  slug: z.string().regex(/^([a-z0-9][a-z0-9-]{0,60})?$/),
  /** Its name in breadcrumbs and in the admin. */
  title: lineText,
  seo: seoSchema,
  sections: collectionSchema(sectionSchema, 40)
});
var navigationSchema = z.object({
  /** The links in the bar on wide screens. */
  barLinks: collectionSchema(linkSchema, 8),
  /** The rows of the full-screen menu; "services" lists every service under its label. */
  menu: collectionSchema(z.object({ label: lineText, href: hrefSchema, kind: z.enum(["link", "services"]) }), 12),
  menuButton: lineText
});
var footerSchema = z.object({
  contactHeading: lineText,
  servicesHeading: lineText,
  companyHeading: lineText,
  companyLinks: collectionSchema(linkSchema, 12),
  button: linkSchema,
  copyrightName: lineText,
  orgLabel: lineText,
  vatLabel: lineText
});
var formSchema = z.object({
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
  emailSubject: lineText
});
var servicePageSchema = z.object({
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
  breadcrumbHref: hrefSchema
});
var uiSchema = z.object({
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
  cookieSettings: lineText.optional()
});
var notFoundSchema = z.object({ eyebrow: lineText, heading: lineText, text: longText, button: linkSchema, seoTitle: lineText });
var siteDataSchema = z.object({
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
  pages: collectionSchema(pageSchema, 30)
});
var SITE_ROOT_KEYS = Object.keys(siteDataSchema.shape);

// supabase/functions/_shared/site/paths.ts
var pathKey = (path) => path.join(".");
function getAt(doc, path) {
  let node = doc;
  for (const key of path) {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return void 0;
    node = node[key];
  }
  return node;
}
function setAt(doc, path, value) {
  if (path.length === 0) return value;
  if (Array.isArray(doc)) throw new Error(`Cannot change part of a list (${pathKey(path)})`);
  const node = doc !== null && typeof doc === "object" ? doc : {};
  const [head, ...rest] = path;
  return { ...node, [head]: setAt(node[head], rest, value) };
}
function deleteAt(doc, path) {
  if (path.length === 0 || doc === null || typeof doc !== "object" || Array.isArray(doc)) return doc;
  const node = doc;
  const [head, ...rest] = path;
  if (!(head in node)) return doc;
  if (rest.length === 0) {
    const { [head]: _removed, ...others } = node;
    return others;
  }
  return { ...node, [head]: deleteAt(node[head], rest) };
}
function applyPatch(doc, patch) {
  return patch.op === "delete" ? deleteAt(doc, patch.path) : setAt(doc, patch.path, patch.value);
}
function applyPatches(doc, patches) {
  const ordered = [...patches].sort((a, b) => a.path.length - b.path.length || pathKey(a.path).localeCompare(pathKey(b.path)));
  return ordered.reduce(applyPatch, doc);
}
function isPrefix(prefix, path) {
  return prefix.length <= path.length && prefix.every((key, index) => path[index] === key);
}

// supabase/functions/_shared/site/labels.ts
var link = (key, label, hint) => ({ key, label, kind: "link", hint });
var heading = (recommended = 60) => ({ key: "heading", label: "Rubrik", kind: "text", recommended });
var intro = (key = "text", label = "Text", recommended = 220) => ({ key, label, kind: "textarea", recommended });
var sectionTypeLabels = {
  hero: { label: "Toppen", description: "Den stora bilden med rubrik och knapp h\xF6gst upp" },
  services: { label: "Tj\xE4nster", description: "Korten med alla tj\xE4nster" },
  uppdragCarousel: { label: "Uppdrag", description: "Bildspelet med typer av uppdrag" },
  stats: { label: "Siffror", description: "N\xE5gra siffror om f\xF6retaget" },
  feature: { label: "Bildband med kort", description: "Ett bildband med rubrik och tv\xE5 kort under" },
  promo: { label: "Erbjudanden", description: "Stora bilder med en f\xE4rgad textruta" },
  about: { label: "Om oss", description: "Kort om f\xF6retaget med en bild" },
  process: { label: "S\xE5 g\xE5r det till", description: "Stegen fr\xE5n kontakt till f\xE4rdigt arbete" },
  faq: { label: "Vanliga fr\xE5gor", description: "Fr\xE5gor och svar" },
  contact: { label: "Kontakt", description: "Kontaktuppgifter och offertformul\xE4r" },
  map: { label: "Karta", description: "Karta med adressen" },
  pageHero: { label: "Bild \xF6verst", description: "En bred bild h\xF6gst upp p\xE5 sidan" },
  aboutIntro: { label: "Inledning", description: "Rubrik, text och faktaruta" },
  photoPair: { label: "Tv\xE5 bilder", description: "Tv\xE5 bilder bredvid varandra" },
  band: { label: "F\xE4rgat band", description: "Text, en bred bild och mer text p\xE5 f\xE4rgad bakgrund" },
  certificates: { label: "Certifikat", description: "F\xF6retagets certifikat och beh\xF6righeter" },
  uppdragGrid: { label: "Projekt", description: "Alla projekt som kort" },
  cta: { label: "Uppmaning", description: "En rubrik och knapp som leder till offertformul\xE4ret" },
  team: { label: "Teamet", description: "Personerna i f\xF6retaget" },
  gallery: { label: "Bildgalleri", description: "Bilder i ett rutn\xE4t" },
  pricelist: { label: "Prislista", description: "Tj\xE4nster och priser" },
  testimonials: { label: "Omd\xF6men", description: "Vad kunderna s\xE4ger" },
  text: { label: "Text", description: "Fri text, med bild och knapp om du vill" },
  timeline: { label: "Tidslinje", description: "Uppdrag eller projekt som staplar p\xE5 en tidslinje" },
  model: { label: "3D-modell", description: "En 3D-modell som bes\xF6karen kan vrida, med rubrik och text" },
  overlay: { label: "Bild med m\xF6rk ruta", description: "En bred bild med en m\xF6rk textruta som ligger \xF6ver" },
  beforeAfter: { label: "F\xF6re och efter", description: "Tv\xE5 bilder bredvid varandra, m\xE4rkta f\xF6re och efter" },
  values: { label: "M\xF6rkt band med kort", description: "Rubrik, text och n\xE5gra kort med symbol p\xE5 m\xF6rk bakgrund" },
  area: { label: "Omr\xE5de och karta", description: "Orterna ni arbetar i och en karta" }
};
var iconHint = "En liten symbol som visas bredvid rubriken.";
var sectionFields = {
  hero: [
    { key: "heading", label: "Rubrik", kind: "text", recommended: 50, hint: "Syns stort \xF6ver bilden \u2013 h\xE5ll den kort." },
    intro("text", "Text under rubriken", 140),
    link("button", "Knapp", "Bredvid den visas en knapp som ringer f\xF6retagets telefonnummer."),
    { key: "image", label: "Bild", kind: "image", imageUsage: "hero" }
  ],
  services: [
    heading(),
    link("link", "L\xE4nk bredvid rubriken"),
    { key: "moreHeading", label: "Rubrik i rutan med mindre uppdrag", kind: "text", recommended: 30, hint: "L\xE4mna tomt f\xF6r att inte visa rutan." },
    {
      key: "moreItems",
      label: "Mindre uppdrag",
      kind: "collection",
      item: { label: "Uppdrag", titleKey: "label", max: 20, fields: [{ key: "label", label: "Text", kind: "text", recommended: 30 }] }
    },
    { key: "ctaHeading", label: "Rubrik i den f\xE4rgade rutan", kind: "text", recommended: 40, hint: "L\xE4mna tomt f\xF6r att inte visa rutan." },
    intro("ctaText", "Text i den f\xE4rgade rutan", 120),
    link("ctaButton", "Knapp i den f\xE4rgade rutan")
  ],
  uppdragCarousel: [heading(), intro(), link("link", "L\xE4nk")],
  stats: [
    heading(),
    {
      key: "items",
      label: "Siffror",
      kind: "collection",
      item: {
        label: "Siffra",
        titleKey: "label",
        max: 4,
        fields: [
          { key: "label", label: "Text under siffran", kind: "text", recommended: 24 },
          {
            key: "valueType",
            label: "Typ",
            kind: "select",
            options: [
              { value: "number", label: "Ett tal" },
              { value: "yearsSince", label: "\xC5r sedan ett \xE5rtal (r\xE4knas upp av sig sj\xE4lv)" }
            ]
          },
          { key: "value", label: "Tal eller \xE5rtal", kind: "number", min: 0 },
          { key: "countUp", label: "R\xE4kna upp n\xE4r den syns", kind: "toggle" }
        ]
      }
    }
  ],
  feature: [
    heading(),
    intro(),
    { key: "image", label: "Bild i bandet", kind: "image", imageUsage: "hero" },
    {
      key: "cards",
      label: "Kort",
      kind: "collection",
      item: {
        label: "Kort",
        titleKey: "heading",
        max: 4,
        fields: [
          heading(40),
          intro("text", "Text", 200),
          { key: "icon", label: "Symbol", kind: "icon", hint: iconHint },
          link("link", "Knapp"),
          { key: "image", label: "Bild", kind: "image", imageUsage: "portrait" }
        ]
      }
    }
  ],
  promo: [
    {
      key: "boxes",
      label: "Erbjudanden",
      kind: "collection",
      item: {
        label: "Erbjudande",
        titleKey: "heading",
        max: 6,
        fields: [
          heading(50),
          intro("text", "Text", 220),
          link("link", "Knapp"),
          { key: "image", label: "Bild", kind: "image", imageUsage: "hero" },
          {
            key: "side",
            label: "Textrutans plats p\xE5 stor sk\xE4rm",
            kind: "select",
            options: [
              { value: "left", label: "Till v\xE4nster" },
              { value: "right", label: "Till h\xF6ger" }
            ]
          }
        ]
      }
    }
  ],
  about: [
    heading(),
    { key: "subheading", label: "Ingress", kind: "textarea", recommended: 220 },
    intro("text", "Text", 400),
    {
      key: "facts",
      label: "Fakta under texten",
      kind: "collection",
      item: {
        label: "Fakta",
        titleKey: "label",
        max: 12,
        fields: [
          { key: "label", label: "Etikett", kind: "text", recommended: 20 },
          { key: "value", label: "V\xE4rde", kind: "text", recommended: 40 }
        ]
      }
    },
    link("link", "Knapp"),
    { key: "image", label: "Bild", kind: "image", imageUsage: "portrait" },
    { key: "badgeValue", label: "Runda m\xE4rket: stor text", kind: "text", recommended: 6, hint: "Till exempel \u201D5/5\u201D. L\xE4mna tomt f\xF6r inget m\xE4rke." },
    { key: "badgeLabel", label: "Runda m\xE4rket: liten text", kind: "text", recommended: 14 }
  ],
  process: [
    heading(),
    intro(),
    {
      key: "steps",
      label: "Steg",
      kind: "collection",
      item: {
        label: "Steg",
        titleKey: "title",
        max: 8,
        fields: [
          { key: "title", label: "Rubrik", kind: "text", recommended: 30 },
          { key: "description", label: "Text", kind: "textarea", recommended: 160 },
          { key: "icon", label: "Symbol", kind: "icon", hint: iconHint }
        ]
      }
    }
  ],
  faq: [
    heading(),
    { key: "phonePrompt", label: "Text f\xF6re telefonnumret", kind: "text", recommended: 50, hint: "L\xE4mna tomt f\xF6r att inte visa telefonnumret h\xE4r." },
    {
      key: "items",
      label: "Fr\xE5gor",
      kind: "collection",
      item: {
        label: "Fr\xE5ga",
        titleKey: "question",
        max: 40,
        fields: [
          { key: "question", label: "Fr\xE5ga", kind: "text", recommended: 90 },
          { key: "answer", label: "Svar", kind: "textarea", recommended: 400 }
        ]
      }
    }
  ],
  contact: [
    heading(),
    intro(),
    { key: "formHeading", label: "Rubrik \xF6ver formul\xE4ret", kind: "text", recommended: 30 },
    { key: "phoneLabel", label: "Etikett f\xF6r telefon", kind: "text" },
    { key: "emailLabel", label: "Etikett f\xF6r e-post", kind: "text" },
    { key: "addressLabel", label: "Etikett f\xF6r adress", kind: "text" },
    { key: "openingHoursLabel", label: "Etikett f\xF6r \xF6ppettider", kind: "text" },
    { key: "orgLabel", label: "Etikett f\xF6r organisationsnummer", kind: "text" }
  ],
  map: [
    heading(),
    { key: "addressPrefix", label: "Text f\xF6re adressen", kind: "text" },
    { key: "linkLabel", label: "L\xE4nktext till Google Maps", kind: "text" },
    { key: "zoom", label: "Zoomniv\xE5", kind: "number", min: 3, max: 20, hint: "Ett l\xE4gre tal visar ett st\xF6rre omr\xE5de, ett h\xF6gre fler detaljer." }
  ],
  pageHero: [
    { key: "heading", label: "Rubrik", kind: "text", recommended: 40, hint: "Sidans huvudrubrik, \xF6ver bilden." },
    intro("text", "Text under rubriken", 160),
    link("button", "Knapp", "L\xE4mna texten tom f\xF6r ingen knapp. Bredvid den visas en knapp som ringer f\xF6retaget."),
    { key: "image", label: "Bild", kind: "image", imageUsage: "hero" },
    {
      key: "size",
      label: "H\xF6jd",
      kind: "select",
      options: [
        { value: "tall", label: "H\xF6g" },
        { value: "medium", label: "Medel" }
      ]
    }
  ],
  aboutIntro: [
    heading(),
    { key: "subheading", label: "Ingress", kind: "textarea", recommended: 160 },
    { key: "paragraphs", label: "Text", kind: "paragraphs", hint: "Tom rad mellan stycken." },
    { key: "factsTitle", label: "Faktarutans rubrik", kind: "text" },
    {
      key: "facts",
      label: "Fakta",
      kind: "collection",
      item: {
        label: "Fakta",
        titleKey: "label",
        max: 12,
        fields: [
          { key: "label", label: "Etikett", kind: "text", recommended: 20 },
          { key: "value", label: "V\xE4rde", kind: "text", recommended: 40 }
        ]
      }
    }
  ],
  photoPair: [
    {
      key: "photos",
      label: "Bilder",
      kind: "collection",
      item: { label: "Bild", titleKey: "", max: 2, fields: [{ key: "image", label: "Bild", kind: "image", imageUsage: "photo" }] }
    }
  ],
  band: [
    heading(),
    intro(),
    link("link", "Knapp"),
    { key: "image", label: "Bild", kind: "image", imageUsage: "hero" },
    { key: "secondHeading", label: "Andra rubriken", kind: "text", recommended: 60 },
    { key: "secondText", label: "Andra texten", kind: "textarea", recommended: 220 },
    link("secondLink", "Andra knappen")
  ],
  certificates: [
    heading(),
    intro(),
    { key: "issuerPrefix", label: "Text f\xF6re utf\xE4rdaren", kind: "text" },
    { key: "validUntilPrefix", label: "Text f\xF6re giltighetsdatum", kind: "text" },
    { key: "emptyHeading", label: "Rubrik n\xE4r listan \xE4r tom", kind: "text" },
    { key: "emptyText", label: "Text n\xE4r listan \xE4r tom (f\xF6ljs av telefonnumret)", kind: "textarea" }
  ],
  uppdragGrid: [heading(), intro(), { key: "filterAllLabel", label: "L\xE4nktext p\xE5 korten", kind: "text", recommended: 20, hint: "Till exempel \u201DSe projektet\u201D." }],
  cta: [heading(), intro(), link("button", "Knapp")],
  team: [
    heading(),
    intro(),
    {
      key: "members",
      label: "Personer",
      kind: "collection",
      item: {
        label: "Person",
        titleKey: "name",
        max: 40,
        fields: [
          { key: "name", label: "Namn", kind: "text", recommended: 40 },
          { key: "role", label: "Roll", kind: "text", recommended: 40 },
          { key: "phone", label: "Telefon", kind: "text" },
          { key: "email", label: "E-post", kind: "text" },
          { key: "image", label: "Bild", kind: "optionalImage", imageUsage: "portrait" }
        ]
      }
    }
  ],
  gallery: [
    heading(),
    intro(),
    link("link", "L\xE4nk bredvid rubriken", "L\xE4mna texten tom f\xF6r ingen l\xE4nk."),
    {
      key: "images",
      label: "Bilder",
      kind: "collection",
      item: {
        label: "Bild",
        titleKey: "caption",
        max: 60,
        fields: [
          { key: "image", label: "Bild", kind: "image", imageUsage: "photo" },
          { key: "caption", label: "Bildtext", kind: "text", recommended: 80 }
        ]
      }
    }
  ],
  pricelist: [
    heading(),
    intro(),
    {
      key: "rows",
      label: "Priser",
      kind: "collection",
      item: {
        label: "Rad",
        titleKey: "name",
        max: 60,
        fields: [
          { key: "name", label: "Tj\xE4nst", kind: "text", recommended: 50 },
          { key: "description", label: "Beskrivning", kind: "textarea", recommended: 140 },
          { key: "price", label: "Pris", kind: "text", recommended: 20, hint: "Till exempel \u201Dfr\xE5n 12 000 kr\u201D." }
        ]
      }
    },
    { key: "note", label: "Not under listan", kind: "textarea", recommended: 200 }
  ],
  testimonials: [
    heading(),
    intro(),
    {
      key: "items",
      label: "Omd\xF6men",
      kind: "collection",
      item: {
        label: "Omd\xF6me",
        titleKey: "name",
        max: 40,
        fields: [
          { key: "title", label: "Uppdraget", kind: "text", recommended: 40, hint: "Visas litet ovanf\xF6r omd\xF6met, t.ex. \u201DHelrenovering av badrum\u201D." },
          { key: "quote", label: "Omd\xF6me", kind: "textarea", recommended: 300 },
          { key: "name", label: "Namn", kind: "text", recommended: 40 },
          { key: "detail", label: "Ort eller uppdrag", kind: "text", recommended: 40 },
          { key: "rating", label: "Stj\xE4rnor", kind: "number", min: 0, max: 5, hint: "1\u20135, eller 0 f\xF6r inga stj\xE4rnor." },
          { key: "image", label: "Bild", kind: "optionalImage", imageUsage: "square" }
        ]
      }
    }
  ],
  text: [
    heading(),
    { key: "paragraphs", label: "Text", kind: "paragraphs", hint: "Tom rad mellan stycken." },
    { key: "image", label: "Bild", kind: "optionalImage", imageUsage: "photo" },
    {
      key: "imageSide",
      label: "Bildens plats",
      kind: "select",
      options: [
        { value: "right", label: "Till h\xF6ger" },
        { value: "left", label: "Till v\xE4nster" }
      ]
    },
    { key: "button", label: "Knapp", kind: "optionalLink" },
    {
      key: "tone",
      label: "Bakgrund",
      kind: "select",
      options: [
        { value: "light", label: "Ljus" },
        { value: "card", label: "Ljus ruta" },
        { value: "primary", label: "Prim\xE4rf\xE4rg" }
      ]
    }
  ],
  overlay: [
    heading(),
    intro("text", "Text", 260),
    {
      key: "chips",
      label: "Sm\xE5 etiketter",
      kind: "collection",
      item: { label: "Etikett", titleKey: "label", max: 10, fields: [{ key: "label", label: "Text", kind: "text", recommended: 24 }] }
    },
    link("link", "Knapp"),
    { key: "image", label: "Bild", kind: "image", imageUsage: "hero" }
  ],
  beforeAfter: [
    heading(),
    link("link", "L\xE4nk bredvid rubriken", "L\xE4mna texten tom f\xF6r ingen l\xE4nk."),
    { key: "beforeLabel", label: "Etikett p\xE5 f\xF6rsta bilden", kind: "text", recommended: 10 },
    { key: "before", label: "Bild f\xF6re", kind: "image", imageUsage: "photo" },
    { key: "afterLabel", label: "Etikett p\xE5 andra bilden", kind: "text", recommended: 10 },
    { key: "after", label: "Bild efter", kind: "image", imageUsage: "photo" }
  ],
  values: [
    heading(),
    intro("text", "Text bredvid rubriken", 260),
    {
      key: "items",
      label: "Kort",
      kind: "collection",
      item: {
        label: "Kort",
        titleKey: "heading",
        max: 6,
        fields: [heading(40), intro("text", "Text", 200), { key: "icon", label: "Symbol", kind: "icon", hint: iconHint }]
      }
    }
  ],
  area: [
    heading(),
    intro("text", "Text", 200),
    {
      key: "places",
      label: "Orter",
      kind: "collection",
      item: { label: "Ort", titleKey: "label", max: 30, fields: [{ key: "label", label: "Namn", kind: "text", recommended: 24 }] }
    },
    link("link", "Knapp", "Till exempel en l\xE4nk till Google Maps."),
    { key: "mapQuery", label: "Det kartan visar", kind: "text", recommended: 60, hint: "Skrivs som i Google Maps, t.ex. \u201DG\xF6teborg\u201D." }
  ],
  timeline: [
    heading(),
    intro("text", "Text bredvid rubriken", 220),
    {
      key: "items",
      label: "Poster",
      kind: "collection",
      item: {
        label: "Post",
        titleKey: "title",
        max: 12,
        fields: [
          { key: "title", label: "Rubrik", kind: "text", recommended: 70 },
          intro("text", "Text", 300),
          { key: "start", label: "Start (\xC5\xC5\xC5\xC5-MM)", kind: "text", placeholder: "2025-06", hint: "Till exempel 2025-06 f\xF6r juni 2025." },
          { key: "end", label: "Slut (\xC5\xC5\xC5\xC5-MM)", kind: "text", placeholder: "2026-04", hint: "Samma format. L\xE4mna tomt om det p\xE5g\xE5r." }
        ]
      }
    }
  ],
  model: [
    heading(),
    intro("text", "Text", 260),
    {
      key: "model",
      label: "Modell",
      kind: "select",
      options: [
        { value: "koncern", label: "Tre byggnader p\xE5 en grund (verksamheterna)" },
        { value: "system", label: "Systemlandskap (ERP, CRM, CPQ)" },
        { value: "building", label: "Fastighet med v\xE5ningar" },
        { value: "frame", label: "Byggstomme som monteras" }
      ]
    },
    { key: "caption", label: "Bildtext under modellen", kind: "text", recommended: 90 },
    {
      key: "parts",
      label: "Etiketter p\xE5 modellen",
      kind: "collection",
      item: {
        label: "Etikett",
        titleKey: "label",
        max: 4,
        fields: [
          { key: "label", label: "Text", kind: "text", recommended: 20 },
          { key: "color", label: "F\xE4rg n\xE4r den markeras", kind: "text", placeholder: "#E2601A", hint: "Som #RRGGBB. Anv\xE4nds p\xE5 modellen med tre byggnader." }
        ]
      }
    }
  ]
};
var eyebrowField = { key: "eyebrow", label: "Liten text ovanf\xF6r rubriken", kind: "text", recommended: 40, hint: "L\xE4mna tomt f\xF6r ingen." };
for (const fields of Object.values(sectionFields)) fields.unshift(eyebrowField);
var colorRoleLabels = {
  primary: { label: "Prim\xE4rf\xE4rg", group: "Grundf\xE4rger", hint: "F\xE4rgade band, faktarutor och erbjudanden." },
  secondary: { label: "Sekund\xE4rf\xE4rg", group: "Grundf\xE4rger", hint: "M\xF6rkare nyans bakom bilder och vid hovring." },
  accent: { label: "Accentf\xE4rg", group: "Grundf\xE4rger", hint: "Symboler, etiketter och sm\xE5 detaljer." },
  background: { label: "Bakgrund", group: "Grundf\xE4rger" },
  surface: { label: "Kort och rutor", group: "Ytor", hint: "Tj\xE4nstekort, formul\xE4rrutan och andra ljusa rutor." },
  input: { label: "Formul\xE4rf\xE4lt och ljusa ytor", group: "Ytor" },
  border: { label: "Linjer och ramar", group: "Ytor", hint: "Visas tunt (genomskinligt) mot bakgrunden." },
  text: { label: "Br\xF6dtext", group: "Text" },
  heading: { label: "Rubriker", group: "Text" },
  muted: { label: "Diskret text", group: "Text", hint: "Etiketter och sm\xE5 texter." },
  subtle: { label: "Inaktiva detaljer", group: "Text", hint: "Till exempel prickarna under bildspelet." },
  link: { label: "L\xE4nkar", group: "Text" },
  onPrimary: { label: "Text p\xE5 prim\xE4rf\xE4rg", group: "Text" },
  button: { label: "Knappar", group: "Knappar" },
  buttonHover: { label: "Knappar vid hovring", group: "Knappar" },
  buttonText: { label: "Knapptext", group: "Knappar" },
  navigation: { label: "Navigering", group: "Navigering och sidfot" },
  navigationText: { label: "Navigeringstext", group: "Navigering och sidfot" },
  footer: { label: "Sidfot", group: "Navigering och sidfot" },
  footerText: { label: "Sidfotstext", group: "Navigering och sidfot" },
  success: { label: "Bekr\xE4ftelse", group: "Meddelanden" },
  warning: { label: "Varning", group: "Meddelanden" },
  error: { label: "Fel", group: "Meddelanden" }
};
var fontRoleLabels = { heading: "Rubriker", body: "Br\xF6dtext", button: "Knappar" };
var rootLabels = {
  theme: "F\xE4rger och typsnitt",
  settings: "Hemsideinst\xE4llningar",
  company: "F\xF6retagsuppgifter",
  navigation: "Meny",
  footer: "Sidfot",
  form: "Offertformul\xE4r",
  ui: "\xD6vriga texter",
  servicePage: "Tj\xE4nstesidor",
  notFound: "Sidan som inte finns",
  services: "Tj\xE4nster",
  uppdrag: "Projekt",
  certificates: "Certifikat",
  pages: "Sidor"
};
var text2 = (key, label, recommended, hint) => ({ key, label, kind: "text", recommended, hint });
var area = (key, label, recommended, hint) => ({ key, label, kind: "textarea", recommended, hint });
var group = (key, label, fields, hint) => ({ key, label, kind: "group", fields, hint });
var forScreenReaders = "L\xE4ses upp f\xF6r personer som anv\xE4nder sk\xE4rml\xE4sare; syns inte.";
var seoFields = [
  text2("title", "Titel i s\xF6kresultatet", 60, "Det bl\xE5a, klickbara i Googles resultat."),
  area("description", "Beskrivning i s\xF6kresultatet", 155, "Texten under titeln i Googles resultat.")
];
var pageFields = [
  text2("title", "Sidans namn", 40, "Visas i s\xF6kv\xE4gen \xF6verst p\xE5 sidan och h\xE4r i adminpanelen."),
  { key: "seo", label: "S\xE5 visas sidan p\xE5 Google", kind: "seo", fields: seoFields }
];
var linkItem = (label, max) => ({
  label,
  titleKey: "label",
  max,
  fields: [text2("label", "Text", 30), { key: "href", label: "Leder till", kind: "href" }]
});
var rootCollections = {
  services: {
    label: "Tj\xE4nst",
    titleKey: "name",
    max: 40,
    fields: [
      text2("name", "Namn", 40),
      { key: "slug", label: "Sidans adress", kind: "slug", hint: "\xC4ndra helst inte \u2013 l\xE4nkar till sidan slutar fungera." },
      area("shortDescription", "Kort beskrivning", 160, "Visas p\xE5 tj\xE4nstekorten och \xF6verst p\xE5 tj\xE4nstens sida."),
      area("lead", "Ingress p\xE5 tj\xE4nstens sida", 160, "Den stora f\xF6rsta raden i texten."),
      { key: "description", label: "Text p\xE5 tj\xE4nstens sida", kind: "paragraphs", hint: "Tom rad mellan stycken." },
      { key: "includes", label: "Det h\xE4r kan ing\xE5", kind: "paragraphs", hint: "En punkt per stycke \u2013 tom rad mellan punkterna." },
      text2("galleryHeading", "Rubrik \xF6ver bilderna", 40),
      link("galleryLink", "L\xE4nk bredvid bildernas rubrik", "L\xE4mna texten tom f\xF6r ingen l\xE4nk."),
      {
        key: "gallery",
        label: "Bilder p\xE5 tj\xE4nstens sida",
        kind: "collection",
        item: {
          label: "Bild",
          titleKey: "caption",
          max: 12,
          fields: [
            { key: "image", label: "Bild", kind: "image", imageUsage: "photo" },
            text2("caption", "Bildtext", 60)
          ]
        }
      },
      { key: "icon", label: "Symbol", kind: "icon", hint: "Visas i menyn och p\xE5 korten." },
      { key: "image", label: "Bild", kind: "image", imageUsage: "hero" },
      { key: "seo", label: "S\xE5 visas sidan p\xE5 Google", kind: "seo", fields: seoFields }
    ]
  },
  uppdrag: {
    label: "Uppdrag",
    titleKey: "title",
    max: 60,
    fields: [
      text2("title", "Rubrik", 60),
      text2("tag", "Kategori", 24, "Uppdrag med samma kategori g\xE5r att filtrera fram p\xE5 uppdragssidan."),
      area("text", "Kort text", 160),
      { key: "href", label: "Leder till", kind: "href" },
      { key: "image", label: "Bild", kind: "image", imageUsage: "photo" }
    ]
  },
  certificates: {
    label: "Certifikat",
    titleKey: "name",
    max: 60,
    fields: [
      text2("name", "Namn", 80),
      text2("issuer", "Utf\xE4rdat av", 60),
      text2("validUntil", "Giltigt till", 30, "Till exempel \u201D2027-06-30\u201D eller \u201DTills vidare\u201D. L\xE4mna tomt om det inte beh\xF6vs."),
      area("description", "Beskrivning", 300),
      { key: "image", label: "M\xE4rke eller logga", kind: "optionalImage", imageUsage: "logo" }
    ]
  }
};
var rootFields = {
  navigation: [
    text2("menuButton", "Knappen i menyraden", 16),
    { key: "barLinks", label: "L\xE4nkar i menyraden (stora sk\xE4rmar)", kind: "collection", item: linkItem("L\xE4nk", 8) },
    {
      key: "menu",
      label: "Rader i menyn",
      kind: "collection",
      item: {
        label: "Rad",
        titleKey: "label",
        max: 12,
        fields: [
          text2("label", "Text", 24),
          { key: "href", label: "Leder till", kind: "href" },
          {
            key: "kind",
            label: "Under raden",
            kind: "select",
            options: [
              { value: "link", label: "Ingenting" },
              { value: "services", label: "Alla tj\xE4nster" }
            ]
          }
        ]
      }
    }
  ],
  footer: [
    text2("contactHeading", "Rubrik \xF6ver kontaktuppgifterna", 24),
    text2("servicesHeading", "Rubrik \xF6ver tj\xE4nsterna", 24),
    text2("companyHeading", "Rubrik \xF6ver l\xE4nkarna", 24),
    { key: "companyLinks", label: "L\xE4nkar", kind: "collection", item: linkItem("L\xE4nk", 12) },
    link("button", "Knapp"),
    text2("copyrightName", "Namn efter \xA9", 60, "\xC5rtalet s\xE4tts automatiskt."),
    text2("orgLabel", "Etikett f\xF6r organisationsnummer", 20),
    text2("vatLabel", "Etikett f\xF6r momsregistreringsnummer", 20)
  ],
  form: [
    text2("modalHeading", "Rubrik", 30),
    group("labels", "F\xE4ltens namn", [
      text2("name", "Namn"),
      text2("phone", "Telefon"),
      text2("email", "E-post"),
      text2("workType", "Typ av arbete"),
      text2("description", "Beskrivning")
    ]),
    text2("workTypePlaceholder", "Text i listan innan n\xE5got \xE4r valt", 40),
    { key: "workTypes", label: "Typer av arbete att v\xE4lja mellan", kind: "collection", item: { label: "Typ", titleKey: "label", max: 20, fields: [text2("label", "Namn", 40)] } },
    text2("descriptionPlaceholder", "Exempeltext i beskrivningsf\xE4ltet", 60),
    text2("contactHint", "Hj\xE4lptext om telefon och e-post", 60),
    group("errors", "Felmeddelanden", [
      text2("name", "Namn saknas"),
      text2("contact", "Telefon och e-post saknas"),
      text2("phone", "Ogiltigt telefonnummer"),
      text2("email", "Ogiltig e-postadress"),
      text2("workType", "Typ av arbete saknas")
    ]),
    text2("submit", "Skicka-knappen", 30),
    text2("sending", "Medan f\xF6rfr\xE5gan skickas", 30),
    text2("confirmation", "Tack-meddelande", 50),
    text2("sendFailed", "N\xE4r n\xE5got gick fel", 120, "F\xF6ljs av telefonnumret."),
    text2("closeHint", "Tips om att st\xE4nga rutan", 120, "F\xF6ljs av st\xE4ngknappens text."),
    text2("closeHintButton", "St\xE4ngknappens text i tipset", 10),
    text2("emailSubject", "\xC4mnesrad i mejlet till er", 60, "{namn} byts mot avs\xE4ndarens namn.")
  ],
  servicePage: [
    text2("eyebrow", "Liten text ovanf\xF6r tj\xE4nstens namn", 40),
    text2("includesHeading", "Rubrik i rutan \u201DDet h\xE4r kan ing\xE5\u201D", 30),
    text2("galleryEyebrow", "Liten text ovanf\xF6r bilderna", 30),
    text2("reviewsEyebrow", "Liten text ovanf\xF6r omd\xF6mena", 30),
    text2("reviewsHeading", "Rubrik \xF6ver omd\xF6mena", 40),
    text2("moreEyebrow", "Liten text ovanf\xF6r andra tj\xE4nster", 30),
    text2("badge", "Etikett \xF6ver tj\xE4nstens text", 20),
    group("cta", "Rutan under texten", [text2("heading", "Rubrik", 60), area("text", "Text", 200), link("button", "Knapp")]),
    text2("factsTitle", "Faktarutans rubrik", 30),
    group("factLabels", "Faktarutans etiketter", [
      text2("service", "Tj\xE4nst"),
      text2("performedBy", "Utf\xF6rs av"),
      text2("seat", "S\xE4te"),
      text2("area", "Omr\xE5de"),
      text2("org", "Organisationsnummer")
    ]),
    text2("contactTagline", "Rad under f\xF6retagsnamnet", 60),
    link("contactButton", "Knapp i kontaktrutan"),
    link("backLink", "Tillbaka-knappen"),
    text2("moreHeading", "Rubrik \xF6ver andra tj\xE4nster", 30),
    text2("breadcrumbLabel", "S\xF6kv\xE4gens mellansteg", 20),
    { key: "breadcrumbHref", label: "Mellansteget leder till", kind: "href" }
  ],
  notFound: [
    text2("eyebrow", "Liten text ovanf\xF6r rubriken", 30),
    text2("heading", "Rubrik", 50),
    area("text", "Text", 200),
    link("button", "Knapp"),
    text2("seoTitle", "Titel i webbl\xE4sarfliken", 50)
  ],
  ui: [
    text2("breadcrumbHome", "F\xF6rsta steget i s\xF6kv\xE4gen", 16),
    text2("stepPrefix", "Ord f\xF6re stegens nummer", 12),
    text2("closeLabel", "St\xE4ngknappar", 16),
    text2("ratingLabel", "Betyg", 30, "{n} byts mot antalet stj\xE4rnor."),
    area("cookieText", "Fr\xE5gan om kakor", 200, "Visas bara om Google Analytics \xE4r kopplat (Inst\xE4llningar)."),
    text2("cookieAccept", "Godk\xE4nn kakor", 16),
    text2("cookieDecline", "Neka kakor", 16),
    text2("cookieSettings", "\xC4ndra kakvalet (knapp i sidfoten)", 20, "Visas bara n\xE4r Google Analytics \xE4r kopplat."),
    text2("skipLink", "Hoppa till inneh\xE5llet", 40, forScreenReaders),
    text2("openMenu", "\xD6ppna menyn", 30, forScreenReaders),
    text2("closeMenu", "St\xE4ng menyn", 30, forScreenReaders),
    text2("menuLabel", "Menyns namn", 30, forScreenReaders),
    text2("mainMenuLabel", "Huvudmenyns namn", 30, forScreenReaders),
    text2("quickLinksLabel", "Snabbl\xE4nkarnas namn", 30, forScreenReaders),
    text2("callPrefix", "F\xF6re telefonnumret p\xE5 ringknappen", 16, forScreenReaders),
    text2("homeLinkLabel", "Loggans l\xE4nk till startsidan", 60, forScreenReaders),
    text2("breadcrumbsLabel", "S\xF6kv\xE4gens namn", 30, forScreenReaders),
    text2("carouselPrevious", "Bildspel: f\xF6reg\xE5ende", 30, forScreenReaders),
    text2("carouselNext", "Bildspel: n\xE4sta", 30, forScreenReaders),
    text2("carouselGoTo", "Bildspel: g\xE5 till en bild", 40, `${forScreenReaders} {n} och {total} byts mot siffror.`),
    text2("uppdragFilterLabel", "Filtret p\xE5 uppdragssidan", 30, forScreenReaders),
    text2("mapTitlePrefix", "F\xF6re kartans namn", 20, forScreenReaders)
  ],
  company: [
    text2("legalName", "F\xF6retagets namn", 60, "Som det \xE4r registrerat, t.ex. i sidfoten och p\xE5 tj\xE4nstesidorna."),
    text2("shortName", "Kort namn", 30, "Anv\xE4nds i loggan och d\xE4r det fulla namnet blir f\xF6r l\xE5ngt."),
    { key: "phone", label: "Telefon", kind: "text", input: "tel" },
    { key: "email", label: "E-post", kind: "text", input: "email", hint: "Offertf\xF6rfr\xE5gningar skickas hit." },
    group("address", "Adress", [
      text2("street", "Gatuadress"),
      text2("postalCode", "Postnummer"),
      text2("city", "Ort"),
      {
        key: "country",
        label: "Land",
        kind: "select",
        options: [
          { value: "SE", label: "Sverige" },
          { value: "NO", label: "Norge" },
          { value: "DK", label: "Danmark" },
          { value: "FI", label: "Finland" }
        ]
      },
      group(
        "geo",
        "Plats p\xE5 kartan",
        [
          { key: "lat", label: "Latitud", kind: "decimal", min: -90, max: 90 },
          { key: "lng", label: "Longitud", kind: "decimal", min: -180, max: 180 }
        ],
        "H\xF6gerklicka p\xE5 platsen i Google Maps s\xE5 visas siffrorna \xF6verst; den f\xF6rsta \xE4r latitud."
      )
    ]),
    text2("openingHours", "\xD6ppettider", 80, "L\xE4mna tomt f\xF6r att inte visa n\xE5gra \xF6ppettider."),
    text2("city", "Hemkommun", 30, "Visas som s\xE4te, t.ex. \u201DS\xE4te i G\xF6teborg\u201D."),
    text2("serviceArea", "Omr\xE5de ni arbetar i", 80),
    { key: "foundedYear", label: "Grundat \xE5r", kind: "year", min: 1800, max: 2100 },
    { key: "employees", label: "Antal anst\xE4llda", kind: "number", min: 0, max: 1e5 },
    text2("orgNumber", "Organisationsnummer"),
    text2("vatNumber", "Momsregistreringsnummer"),
    group("social", "Sociala medier", [
      { key: "facebook", label: "Facebook", kind: "text", input: "url", placeholder: "https://facebook.com/\u2026" },
      { key: "instagram", label: "Instagram", kind: "text", input: "url", placeholder: "https://instagram.com/\u2026" },
      { key: "linkedin", label: "LinkedIn", kind: "text", input: "url", placeholder: "https://linkedin.com/company/\u2026" }
    ])
  ],
  settings: [
    text2("siteName", "Hemsidans namn", 60, "Avslutar titeln i webbl\xE4sarfliken och i s\xF6kresultat, t.ex. \u201DOm oss | \u2026\u201D."),
    { key: "siteUrl", label: "Hemsidans adress", kind: "text", input: "url", hint: "Anv\xE4nds f\xF6r l\xE4nkar i s\xF6kmotorer och sociala medier." },
    { key: "favicon", label: "Ikon i webbl\xE4sarfliken (favicon)", kind: "image", imageUsage: "favicon" },
    { key: "analyticsId", label: "Google Analytics-ID", kind: "text", placeholder: "G-XXXXXXXXXX", hint: "L\xE4mna tomt f\xF6r ingen statistik. N\xE4r det \xE4r ifyllt fr\xE5gar hemsidan bes\xF6karna om kakor f\xF6rst." },
    group("maintenance", "Underh\xE5llsl\xE4ge", [
      { key: "enabled", label: "Visa underh\xE5llssidan i st\xE4llet f\xF6r hemsidan", kind: "toggle" },
      text2("heading", "Rubrik", 50),
      area("text", "Text", 200)
    ])
  ]
};

// supabase/functions/_shared/site/changes.ts
var otherLabels = {
  seo: "S\xF6kmotorer",
  title: "Rubrik",
  description: "Beskrivning",
  order: "ordning",
  hidden: "visas eller d\xF6ljs",
  label: "namn",
  anchor: "ankare",
  name: "Namn",
  shortDescription: "Kort beskrivning",
  slug: "Adress",
  image: "Bild",
  icon: "Symbol",
  phone: "Telefon",
  email: "E-post",
  address: "Adress",
  legalName: "F\xF6retagsnamn",
  orgNumber: "Organisationsnummer",
  openingHours: "\xD6ppettider",
  social: "Sociala medier",
  logo: "Logga",
  favicon: "Favikon",
  maintenance: "Underh\xE5llsl\xE4ge",
  analyticsId: "Google Analytics"
};
function describeIn(doc, base, fields, rest) {
  if (rest.length === 0) return [];
  const [key, ...more] = rest;
  const spec = fields?.find((field) => field.key === key);
  if (!spec) return [otherLabels[key] ?? key];
  if (spec.kind === "collection" && spec.item) {
    if (more[0] === "order" || more.length === 0) return [`${spec.label} (ordning)`];
    if (more[0] === "items" && more[1]) {
      const item = getAt(doc, [...base, key, "items", more[1]]);
      const title = spec.item.titleKey ? String(item?.[spec.item.titleKey] ?? "") : "";
      const name = `${spec.item.label}${title ? ` \u201D${title.slice(0, 40)}\u201D` : ""}`;
      return [name, ...describeIn(doc, [...base, key, "items", more[1]], spec.item.fields, more.slice(2))];
    }
  }
  if (spec.fields && more.length > 0) return [spec.label, ...describeIn(doc, [...base, key], spec.fields, more)];
  return [spec.label];
}
function describePath(doc, path) {
  const [root, ...rest] = path;
  if (root === "pages" && rest[0] === "items" && rest[1]) {
    const page = getAt(doc, ["pages", "items", rest[1]]);
    const pageName = page?.slug === "" ? "Startsidan" : page?.title || rest[1];
    if (rest[2] === "sections" && rest[3] === "items" && rest[4]) {
      const base = ["pages", "items", rest[1], "sections", "items", rest[4]];
      const section = getAt(doc, base);
      const type = section?.type;
      const sectionName = section?.label || (type ? sectionTypeLabels[type]?.label : void 0) || rest[4];
      return [pageName, sectionName, ...describeIn(doc, base, type ? sectionFields[type] : void 0, rest.slice(5))].join(" \u203A ");
    }
    if (rest[2] === "sections") return `${pageName} \u203A sektionernas ordning`;
    if (rest.length === 2) return pageName;
    return [pageName, ...describeIn(doc, ["pages", "items", rest[1]], pageFields, rest.slice(2))].join(" \u203A ");
  }
  const rootName = rootLabels[root] ?? root;
  if (root in rootCollections) {
    const spec = rootCollections[root];
    if (rest[0] === "items" && rest[1]) {
      const item = getAt(doc, [root, "items", rest[1]]);
      const itemName = String(item?.[spec.titleKey] ?? "") || rest[1];
      return [rootName, itemName, ...describeIn(doc, [root, "items", rest[1]], spec.fields, rest.slice(2))].join(" \u203A ");
    }
    return `${rootName} (ordning)`;
  }
  if (root === "theme") {
    const [kind, role] = rest;
    if (kind === "colors" && role) return `F\xE4rger \u203A ${colorRoleLabels[role]?.label ?? role}`;
    if (kind === "fonts" && role) return `Typsnitt \u203A ${fontRoleLabels[role] ?? role}`;
    return rootName;
  }
  if (root === "settings" && rest[0] === "logo") return `${rootName} \u203A Logga`;
  const fields = rootFields[root];
  return [rootName, ...describeIn(doc, [root], fields, rest)].join(" \u203A ");
}

// supabase/functions/_shared/site/pricing.ts
var PRICES = {
  advice: 0,
  minorText: 1,
  theme: 2,
  rewriteSection: 3,
  element: 5,
  layout: 8,
  seo: 8,
  standardSection: 15,
  advancedSection: 20,
  page: 30
};
var priceLabels = {
  advice: "R\xE5d utan \xE4ndring",
  minorText: "Mindre textjustering",
  theme: "F\xE4rger eller typsnitt",
  rewriteSection: "Omskriven sektionstext",
  element: "Element som l\xE4ggs till eller tas bort",
  layout: "Ombyggd layout i en sektion",
  seo: "SEO-optimering av en sida",
  standardSection: "Ny standardsektion",
  advancedSection: "Ny avancerad sektion",
  page: "Ny undersida"
};
var priceTable = [
  { action: "Manuella \xE4ndringar i adminpanelen", credits: "0 (alltid gratis)" },
  { action: "Fr\xE5ga AI:n om r\xE5d, utan \xE4ndring", credits: "0" },
  { action: "Mindre textjustering (rubrik, knapptext, en mening)", credits: "1" },
  { action: "Skriva om en hel sektions text", credits: "3" },
  { action: "\xC4ndra f\xE4rger, typsnitt eller avst\xE5nd via AI", credits: "2" },
  { action: "L\xE4gga till/ta bort ett enskilt element (FAQ-fr\xE5ga, tj\xE4nstekort, statistik)", credits: "5" },
  { action: "Bygga om layouten i en befintlig sektion", credits: "8" },
  { action: "SEO-optimering av en sida (titel, meta, rubrikstruktur)", credits: "8" },
  { action: "Ny standardsektion (om oss, CTA, FAQ, statistik, kontakt)", credits: "15" },
  { action: "Ny avancerad sektion (team, galleri, prislista, recensioner med bilder)", credits: "20" },
  { action: "Flera sektioner i samma uppdrag", credits: "Summan av varje sektion" },
  { action: "Ny undersida", credits: "30" },
  { action: "Misslyckad eller avbruten generering", credits: "0 (dras aldrig)" },
  { action: "\xC5terst\xE4llning av en tidigare version", credits: "0" }
];

// supabase/functions/_shared/site/collection.ts
function list(collection) {
  return collection.order.map((id) => ({ ...collection.items[id], id }));
}

// supabase/functions/_shared/site/pages.ts
var RESERVED_SLUGS = ["admin", "forslag", "tjanster", "photos", "fonts", "cw", "_next", "404", "icon.png", "robots.txt", "sitemap.xml"];

// supabase/functions/_shared/site/changeset.ts
var pathSchema = z2.array(z2.string().min(1).max(80)).min(1).max(14);
var placeSchema = z2.enum(["first", "last", "after"]);
var operationSchema = z2.discriminatedUnion("op", [
  /** Sets one part of the document (a text, a link, a whole section …) to a new value. */
  z2.object({ op: z2.literal("set"), path: pathSchema, valueJson: z2.string().max(2e5) }),
  /** Adds an item to a list (a section to a page, a question to a FAQ …). */
  z2.object({
    op: z2.literal("insert"),
    path: pathSchema,
    id: z2.string().max(64),
    place: placeSchema,
    afterId: z2.string().max(64),
    itemJson: z2.string().max(2e5)
  }),
  /** Removes an item from a list. */
  z2.object({ op: z2.literal("remove"), path: pathSchema, id: z2.string().max(64) }),
  /** Moves an item within its list. */
  z2.object({ op: z2.literal("move"), path: pathSchema, id: z2.string().max(64), place: placeSchema, afterId: z2.string().max(64) })
]);
var changeSetSchema = z2.object({
  summary: z2.string().min(1).max(3e3),
  operations: z2.array(operationSchema).max(80),
  imagesNeeded: z2.array(z2.string().max(400)).max(12)
});
var stringArray = { type: "array", items: { type: "string" } };
var placeEnum = { type: "string", enum: ["first", "last", "after"] };
var changeSetJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "operations", "imagesNeeded"],
  properties: {
    summary: { type: "string" },
    operations: {
      type: "array",
      items: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["op", "path", "valueJson"],
            properties: { op: { type: "string", const: "set" }, path: stringArray, valueJson: { type: "string" } }
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["op", "path", "id", "place", "afterId", "itemJson"],
            properties: {
              op: { type: "string", const: "insert" },
              path: stringArray,
              id: { type: "string" },
              place: placeEnum,
              afterId: { type: "string" },
              itemJson: { type: "string" }
            }
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["op", "path", "id"],
            properties: { op: { type: "string", const: "remove" }, path: stringArray, id: { type: "string" } }
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["op", "path", "id", "place", "afterId"],
            properties: { op: { type: "string", const: "move" }, path: stringArray, id: { type: "string" }, place: placeEnum, afterId: { type: "string" } }
          }
        ]
      }
    },
    imagesNeeded: stringArray
  }
};
var planKinds = ["minorText", "rewriteSection", "theme", "element", "layout", "seo", "standardSection", "advancedSection", "page"];
var planSchema = z2.object({
  reply: z2.string().min(1).max(6e3),
  kind: z2.enum(["answer", "clarify", "change"]),
  summary: z2.string().max(1e3),
  items: z2.array(z2.object({ kind: z2.enum(planKinds), description: z2.string().max(300) })).max(40)
});
var planJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "kind", "summary", "items"],
  properties: {
    reply: { type: "string" },
    kind: { type: "string", enum: ["answer", "clarify", "change"] },
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "description"],
        properties: { kind: { type: "string", enum: planKinds }, description: { type: "string" } }
      }
    }
  }
};
function priceOfPlan(plan) {
  if (plan.kind !== "change") return { lines: [], total: 0 };
  const lines = plan.items.map((item) => ({ key: item.kind, label: item.description || priceLabels[item.kind], credits: PRICES[item.kind] }));
  return { lines, total: lines.reduce((sum, line) => sum + line.credits, 0) };
}
var advancedSections = /* @__PURE__ */ new Set(["team", "gallery", "pricelist", "testimonials"]);
function canonical(value) {
  return JSON.stringify(
    value,
    (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item
  );
}
function changedLeaves(before, after, path = []) {
  if (canonical(before) === canonical(after)) return [];
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  if (isObject(before) && isObject(after)) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)]);
    return Array.from(keys).flatMap((key) => changedLeaves(before[key], after[key], [...path, key]));
  }
  const size = Math.max(JSON.stringify(after ?? "").length, JSON.stringify(before ?? "").length);
  return [{ path, size }];
}
function unitOf(path) {
  if (path[0] === "pages" && path[3] === "sections" && path[5]) return path.slice(0, 6);
  if (path[0] === "pages") return path.slice(0, 3);
  if ((path[0] === "services" || path[0] === "uppdrag" || path[0] === "certificates") && path[1] === "items" && path[2]) return path.slice(0, 3);
  return path.slice(0, 1);
}
function priceChangeSet(before, after, operations) {
  const lines = [];
  const created = [];
  const add = (key, label) => lines.push({ key, label, credits: PRICES[key] });
  for (const operation of operations) {
    if (operation.op !== "insert") continue;
    const target = [...operation.path, "items", operation.id];
    if (created.some((prefix) => isPrefix(prefix, target))) continue;
    created.push(target);
    const item = getAt(after, target);
    if (operation.path.length === 1 && operation.path[0] === "pages") {
      add("page", `Ny undersida: ${String(item?.title ?? operation.id)}`);
    } else if (operation.path[0] === "pages" && operation.path[3] === "sections" && operation.path.length === 4) {
      const type = String(item?.type ?? "");
      const name = sectionTypeLabels[type]?.label ?? type;
      add(advancedSections.has(type) ? "advancedSection" : "standardSection", `Ny sektion: ${name}`);
    } else {
      add("element", `Nytt: ${describePath(after, target)}`);
    }
  }
  for (const operation of operations) {
    if (operation.op !== "remove") continue;
    const target = [...operation.path, "items", operation.id];
    add("element", `Borttaget: ${describePath(before, target)}`);
  }
  const moved = new Set(operations.filter((operation) => operation.op === "move").map((operation) => pathKey(operation.path)));
  for (const key of moved) add("minorText", `Ny ordning: ${describePath(after, key.split("."))}`);
  const removed = operations.filter((operation) => operation.op === "remove").map((operation) => [...operation.path, "items", operation.id]);
  const leaves = changedLeaves(before, after).filter(
    (leaf) => !created.some((prefix) => isPrefix(prefix, leaf.path)) && !removed.some((prefix) => isPrefix(prefix, leaf.path)) && leaf.path[leaf.path.length - 1] !== "order"
  );
  let theme = false;
  const seoUnits = /* @__PURE__ */ new Set();
  const units = /* @__PURE__ */ new Map();
  for (const leaf of leaves) {
    if (leaf.path[0] === "theme") {
      theme = true;
      continue;
    }
    const seoAt = leaf.path.indexOf("seo");
    if (seoAt > 0) {
      seoUnits.add(pathKey(leaf.path.slice(0, seoAt)));
      continue;
    }
    const unit = unitOf(leaf.path);
    const key = pathKey(unit);
    const entry = units.get(key) ?? { path: unit, fields: 0, size: 0, layout: false };
    entry.fields += 1;
    entry.size += leaf.size;
    if (leaf.path.length === unit.length + 1 && leaf.path[leaf.path.length - 1] === "type") entry.layout = true;
    units.set(key, entry);
  }
  if (theme) add("theme", "F\xE4rger eller typsnitt");
  for (const key of seoUnits) add("seo", `SEO: ${describePath(after, key.split("."))}`);
  for (const unit of units.values()) {
    const where = describePath(after, unit.path);
    if (unit.layout) add("layout", `Ny layout: ${where}`);
    else if (unit.fields >= 3 || unit.size > 240) add("rewriteSection", `Omskriven text: ${where}`);
    else for (let i = 0; i < unit.fields; i++) add("minorText", `Justerad text: ${where}`);
  }
  if (lines.length === 0 && operations.length > 0) add("minorText", "Mindre justering");
  return { lines, total: lines.reduce((sum, line) => sum + line.credits, 0) };
}
function isImageLike(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && typeof value.src === "string" && "alt" in value);
}
function imagesBySrc(doc, into = /* @__PURE__ */ new Map()) {
  const walk = (node) => {
    if (isImageLike(node) && Array.isArray(node.variants)) {
      into.set(node.src, node);
      return;
    }
    if (node && typeof node === "object") for (const value of Object.values(node)) walk(value);
  };
  walk(doc);
  return into;
}
function compactForModel(doc) {
  const walk = (node) => {
    if (isImageLike(node) && Array.isArray(node.variants)) {
      const { src, alt, focus } = node;
      return focus ? { src, alt, focus } : { src, alt };
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, walk(value)]));
    return node;
  };
  return walk(doc);
}
function restoreImages(value, known, problems, where) {
  if (isImageLike(value)) {
    const original = known.get(value.src);
    if (!original) {
      problems.push(`${where}: the image "${value.src}" is not one of the site's images or the attached ones. Use an existing image's src exactly, or leave a nullable image null and list what is needed in imagesNeeded.`);
      return value;
    }
    const alt = typeof value.alt === "string" ? value.alt : original.alt;
    const focus = typeof value.focus === "string" ? value.focus : original.focus;
    return { ...original, alt, ...focus ? { focus } : {} };
  }
  if (Array.isArray(value)) return value.map((item) => restoreImages(item, known, problems, where));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restoreImages(item, known, problems, where)]));
  }
  return value;
}
function parseJson(text3, where, problems) {
  try {
    return { ok: true, value: JSON.parse(text3) };
  } catch {
    problems.push(`${where}: the JSON in the string is not valid JSON.`);
    return { ok: false };
  }
}
function isCollection(value) {
  return Boolean(value && typeof value === "object" && Array.isArray(value.order) && typeof value.items === "object");
}
function placed(order, id, place, afterId, problems, where) {
  const without = order.filter((other) => other !== id);
  if (place === "first") return [id, ...without];
  if (place === "last") return [...without, id];
  const index = without.indexOf(afterId);
  if (index < 0) {
    problems.push(`${where}: afterId "${afterId}" is not in this list (ids: ${without.join(", ") || "none"}).`);
    return null;
  }
  return [...without.slice(0, index + 1), id, ...without.slice(index + 1)];
}
function brokenLinks(site) {
  const pages = new Set(list(site.pages).map((page) => page.slug));
  const services = new Set(list(site.services).map((service) => service.slug));
  const home = list(site.pages).find((page) => page.slug === "");
  const homeAnchors = new Set(home ? list(home.sections).map((section) => section.anchor).filter(Boolean) : []);
  const found = [];
  const check = (href, path) => {
    if (!href.startsWith("/")) return;
    const [address, anchor] = href.split("#");
    const parts = address.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    let ok;
    if (parts.length === 0) ok = !anchor || homeAnchors.has(anchor);
    else if (parts[0] === "tjanster" && parts.length === 2) ok = services.has(parts[1]);
    else ok = parts.length === 1 && pages.has(parts[0]);
    if (!ok) found.push({ path, href });
  };
  const walk = (node, path) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if ((key === "href" || key === "breadcrumbHref") && typeof value === "string") check(value, [...path, key]);
      else walk(value, [...path, key]);
    }
  };
  walk(site, []);
  return found;
}
function applyChangeSet(draft, operations, knownImages) {
  const problems = [];
  const patches = [];
  let doc = draft;
  const step = (more) => {
    patches.push(...more);
    doc = applyPatches(doc, more);
  };
  operations.forEach((operation, index) => {
    const where = `Operation ${index + 1} (${operation.op} ${operation.path.join(".")})`;
    if (operation.path[0] === "schemaVersion") {
      problems.push(`${where}: schemaVersion cannot be changed.`);
      return;
    }
    if (operation.op === "set") {
      if (operation.path.length < 2) {
        problems.push(`${where}: set a part inside "${operation.path[0]}", not the whole of it.`);
        return;
      }
      const parsed2 = parseJson(operation.valueJson, where, problems);
      if (!parsed2.ok) return;
      step([{ path: operation.path, op: "set", value: restoreImages(parsed2.value, knownImages, problems, where) }]);
      return;
    }
    const collection = getAt(doc, operation.path);
    if (!isCollection(collection)) {
      problems.push(`${where}: the path does not lead to a list ({order, items}).`);
      return;
    }
    if (operation.op === "insert") {
      if (!idSchema.safeParse(operation.id).success) {
        problems.push(`${where}: the id "${operation.id}" must be lowercase letters, digits and hyphens.`);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(collection.items, operation.id)) {
        problems.push(`${where}: the id "${operation.id}" is already used in this list.`);
        return;
      }
      const parsed2 = parseJson(operation.itemJson, where, problems);
      if (!parsed2.ok) return;
      const order2 = placed(collection.order, operation.id, operation.place, operation.afterId, problems, where);
      if (!order2) return;
      step([
        { path: [...operation.path, "items", operation.id], op: "set", value: restoreImages(parsed2.value, knownImages, problems, where) },
        { path: [...operation.path, "order"], op: "set", value: order2 }
      ]);
      return;
    }
    if (!collection.order.includes(operation.id)) {
      problems.push(`${where}: there is no item "${operation.id}" in this list (ids: ${collection.order.join(", ") || "none"}).`);
      return;
    }
    if (operation.op === "remove") {
      step([
        { path: [...operation.path, "items", operation.id], op: "delete" },
        { path: [...operation.path, "order"], op: "set", value: collection.order.filter((id) => id !== operation.id) }
      ]);
      return;
    }
    const order = placed(collection.order, operation.id, operation.place, operation.afterId, problems, where);
    if (order) step([{ path: [...operation.path, "order"], op: "set", value: order }]);
  });
  const parsed = siteDataSchema.safeParse(doc);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 15)) {
      const path = issue.path.map(String);
      problems.push(`The result breaks the content rules at ${path.join(".") || "(top)"} (${describePath(doc, path)}): ${issue.message}`);
    }
    return { doc: null, patches, problems };
  }
  const site = parsed.data;
  const slugs = list(site.pages).map((page) => page.slug);
  slugs.forEach((slug, index) => {
    if (slugs.indexOf(slug) !== index) problems.push(`Two pages have the address "/${slug}".`);
    if (slug && RESERVED_SLUGS.includes(slug)) problems.push(`The page address "/${slug}" is reserved by the site.`);
  });
  if (!slugs.includes("")) problems.push('The start page (slug "") must remain.');
  const serviceSlugs = list(site.services).map((service) => service.slug);
  serviceSlugs.forEach((slug, index) => {
    if (serviceSlugs.indexOf(slug) !== index) problems.push(`Two services have the address "/tjanster/${slug}".`);
  });
  for (const link2 of brokenLinks(site)) {
    problems.push(`The link "${link2.href}" at ${link2.path.join(".")} leads to a page, service or start-page section that does not exist.`);
  }
  return { doc: problems.length > 0 ? null : site, patches, problems };
}

// supabase/functions/_shared/site/theme.ts
var contrastPairs = [
  { text: "text", background: "background" },
  { text: "heading", background: "background" },
  { text: "muted", background: "background" },
  { text: "link", background: "background" },
  { text: "text", background: "surface" },
  { text: "heading", background: "surface" },
  { text: "muted", background: "surface" },
  { text: "text", background: "input" },
  { text: "error", background: "surface" },
  { text: "buttonText", background: "button" },
  { text: "buttonText", background: "buttonHover" },
  { text: "navigationText", background: "navigation" },
  { text: "footerText", background: "footer" },
  { text: "onPrimary", background: "primary" },
  { text: "onPrimary", background: "secondary", large: true },
  { text: "onPrimary", background: "success" },
  { text: "onPrimary", background: "accent", large: true }
];

// supabase/functions/_shared/site/fonts.ts
var fonts = [
  ["Figtree", "sans-serif", [400, 500, 600, 700, 800]],
  ["Inter", "sans-serif", [400, 500, 600, 700, 800]],
  ["Roboto", "sans-serif", [400, 500, 600, 700, 800]],
  ["Open Sans", "sans-serif", [400, 500, 600, 700, 800]],
  ["Lato", "sans-serif", [400, 700]],
  ["Montserrat", "sans-serif", [400, 500, 600, 700, 800]],
  ["Poppins", "sans-serif", [400, 500, 600, 700, 800]],
  ["Source Sans 3", "sans-serif", [400, 500, 600, 700, 800]],
  ["Nunito Sans", "sans-serif", [400, 500, 600, 700, 800]],
  ["Nunito", "sans-serif", [400, 500, 600, 700, 800]],
  ["Work Sans", "sans-serif", [400, 500, 600, 700, 800]],
  ["Raleway", "sans-serif", [400, 500, 600, 700, 800]],
  ["Rubik", "sans-serif", [400, 500, 600, 700, 800]],
  ["Manrope", "sans-serif", [400, 500, 600, 700, 800]],
  ["DM Sans", "sans-serif", [400, 500, 600, 700, 800]],
  ["Plus Jakarta Sans", "sans-serif", [400, 500, 600, 700, 800]],
  ["Outfit", "sans-serif", [400, 500, 600, 700, 800]],
  ["Mulish", "sans-serif", [400, 500, 600, 700, 800]],
  ["Karla", "sans-serif", [400, 500, 600, 700, 800]],
  ["IBM Plex Sans", "sans-serif", [400, 500, 600, 700]],
  ["Barlow", "sans-serif", [400, 500, 600, 700, 800]],
  ["Barlow Condensed", "sans-serif", [400, 500, 600, 700, 800]],
  ["Archivo", "sans-serif", [400, 500, 600, 700, 800]],
  ["Archivo Narrow", "sans-serif", [400, 500, 600, 700]],
  ["Public Sans", "sans-serif", [400, 500, 600, 700, 800]],
  ["Hanken Grotesk", "sans-serif", [400, 500, 600, 700, 800]],
  ["Space Grotesk", "sans-serif", [400, 500, 600, 700]],
  ["Sora", "sans-serif", [400, 500, 600, 700, 800]],
  ["Lexend", "sans-serif", [400, 500, 600, 700, 800]],
  ["Red Hat Display", "sans-serif", [400, 500, 600, 700, 800]],
  ["Albert Sans", "sans-serif", [400, 500, 600, 700, 800]],
  ["Schibsted Grotesk", "sans-serif", [400, 500, 600, 700, 800]],
  ["Onest", "sans-serif", [400, 500, 600, 700, 800]],
  ["Instrument Sans", "sans-serif", [400, 500, 600, 700]],
  ["Be Vietnam Pro", "sans-serif", [400, 500, 600, 700, 800]],
  ["Heebo", "sans-serif", [400, 500, 600, 700, 800]],
  ["Oswald", "sans-serif", [400, 500, 600, 700]],
  ["Fira Sans", "sans-serif", [400, 500, 600, 700, 800]],
  ["PT Sans", "sans-serif", [400, 700]],
  ["Noto Sans", "sans-serif", [400, 500, 600, 700, 800]],
  ["Josefin Sans", "sans-serif", [400, 500, 600, 700]],
  ["Kanit", "sans-serif", [400, 500, 600, 700, 800]],
  ["Titillium Web", "sans-serif", [400, 600, 700]],
  ["Exo 2", "sans-serif", [400, 500, 600, 700, 800]],
  ["Cabin", "sans-serif", [400, 500, 600, 700]],
  ["Quicksand", "sans-serif", [400, 500, 600, 700]],
  ["Urbanist", "sans-serif", [400, 500, 600, 700, 800]],
  ["Jost", "sans-serif", [400, 500, 600, 700, 800]],
  ["Bricolage Grotesque", "sans-serif", [400, 500, 600, 700, 800]],
  ["Libre Franklin", "sans-serif", [400, 500, 600, 700, 800]],
  ["Chivo", "sans-serif", [400, 500, 600, 700, 800]],
  ["Overpass", "sans-serif", [400, 500, 600, 700, 800]],
  ["Asap", "sans-serif", [400, 500, 600, 700, 800]],
  ["Signika", "sans-serif", [400, 500, 600, 700]],
  ["Saira", "sans-serif", [400, 500, 600, 700, 800]],
  ["Encode Sans", "sans-serif", [400, 500, 600, 700, 800]],
  ["Golos Text", "sans-serif", [400, 500, 600, 700, 800]],
  ["Geologica", "sans-serif", [400, 500, 600, 700, 800]],
  ["Commissioner", "sans-serif", [400, 500, 600, 700, 800]],
  ["Epilogue", "sans-serif", [400, 500, 600, 700, 800]],
  ["Merriweather", "serif", [400, 500, 600, 700, 800]],
  ["Playfair Display", "serif", [400, 500, 600, 700, 800]],
  ["Lora", "serif", [400, 500, 600, 700]],
  ["PT Serif", "serif", [400, 700]],
  ["Libre Baskerville", "serif", [400, 500, 600, 700]],
  ["EB Garamond", "serif", [400, 500, 600, 700, 800]],
  ["Cormorant Garamond", "serif", [400, 500, 600, 700]],
  ["Crimson Pro", "serif", [400, 500, 600, 700, 800]],
  ["Source Serif 4", "serif", [400, 500, 600, 700, 800]],
  ["Noto Serif", "serif", [400, 500, 600, 700, 800]],
  ["Fraunces", "serif", [400, 500, 600, 700, 800]],
  ["DM Serif Display", "serif", [400]],
  ["Spectral", "serif", [400, 500, 600, 700, 800]],
  ["Bitter", "serif", [400, 500, 600, 700, 800]],
  ["Roboto Slab", "serif", [400, 500, 600, 700, 800]],
  ["Zilla Slab", "serif", [400, 500, 600, 700]],
  ["Arvo", "serif", [400, 700]],
  ["Domine", "serif", [400, 500, 600, 700]],
  ["Young Serif", "serif", [400]],
  ["Instrument Serif", "serif", [400]],
  ["Newsreader", "serif", [400, 500, 600, 700, 800]],
  ["Literata", "serif", [400, 500, 600, 700, 800]],
  ["Gelasio", "serif", [400, 500, 600, 700]],
  ["Libre Caslon Text", "serif", [400, 700]],
  ["Brygada 1918", "serif", [400, 500, 600, 700]],
  ["Petrona", "serif", [400, 500, 600, 700, 800]],
  ["Bebas Neue", "display", [400]],
  ["Anton", "display", [400]],
  ["Archivo Black", "display", [400]],
  ["Abril Fatface", "display", [400]],
  ["Alfa Slab One", "display", [400]],
  ["Righteous", "display", [400]],
  ["Teko", "display", [400, 500, 600, 700]],
  ["Big Shoulders Display", "display", [400, 500, 600, 700, 800]],
  ["Unbounded", "display", [400, 500, 600, 700, 800]],
  ["Syne", "display", [400, 500, 600, 700, 800]],
  ["Dela Gothic One", "display", [400]],
  ["Bowlby One", "display", [400]],
  ["Caveat", "handwriting", [400, 500, 600, 700]],
  ["Dancing Script", "handwriting", [400, 500, 600, 700]],
  ["Kalam", "handwriting", [400, 700]],
  ["Patrick Hand", "handwriting", [400]],
  ["Shadows Into Light", "handwriting", [400]],
  ["JetBrains Mono", "monospace", [400, 500, 600, 700, 800]],
  ["IBM Plex Mono", "monospace", [400, 500, 600, 700]],
  ["Space Mono", "monospace", [400, 700]],
  ["Roboto Mono", "monospace", [400, 500, 600, 700]],
  ["Fira Code", "monospace", [400, 500, 600, 700]]
];
var fontOptions = fonts.map(([family, category, weights]) => ({ family, category, weights }));

// supabase/functions/_shared/site/assistant.ts
function describeField(field, indent = "    ") {
  const kinds = {
    text: "string",
    textarea: "string (may hold line breaks)",
    paragraphs: "string[] (one string per paragraph)",
    link: "{label, href} (empty label hides the button)",
    href: "href string",
    optionalLink: "{label, href} | null",
    image: "image {src, alt, focus?}",
    optionalImage: "image {src, alt, focus?} | null",
    number: "integer",
    year: "integer (a year)",
    decimal: "number",
    icon: "icon name",
    select: `one of ${field.options?.map((option) => JSON.stringify(option.value)).join(" | ")}`,
    toggle: "boolean",
    collection: "list {order, items}",
    group: "object",
    slug: "address segment: lowercase a-z, 0-9 and hyphens",
    seo: "{title, description}"
  };
  const kind = kinds[field.kind];
  const limits = [field.recommended ? `about ${field.recommended} characters` : "", field.min !== void 0 ? `min ${field.min}` : "", field.max !== void 0 ? `max ${field.max}` : ""].filter(Boolean).join(", ");
  let line = `${indent}- ${field.key}: ${kind} \u2013 "${field.label}"${limits ? ` (${limits})` : ""}${field.hint ? `. ${field.hint}` : ""}`;
  if (field.kind === "collection" && field.item) {
    line += `
${indent}  each item ("${field.item.label}"${field.item.max ? `, at most ${field.item.max}` : ""}):
${field.item.fields.map((inner) => describeField(inner, `${indent}    `)).join("\n")}`;
  }
  if ((field.kind === "group" || field.kind === "seo") && field.fields) {
    line += `
${field.fields.map((inner) => describeField(inner, `${indent}    `)).join("\n")}`;
  }
  return line;
}
function sectionCatalogue() {
  return Object.keys(sectionFields).map((type) => {
    const meta = sectionTypeLabels[type];
    return `- type "${type}" \u2013 "${meta.label}": ${meta.description}.
  Fields besides type, hidden, anchor, label:
${sectionFields[type].map((field) => describeField(field)).join("\n")}`;
  }).join("\n");
}
function partsCatalogue() {
  const collections = Object.keys(rootCollections).map(
    (root) => `- ${root}: list of "${rootCollections[root].label}" items:
${rootCollections[root].fields.map((field) => describeField(field)).join("\n")}`
  );
  const parts = Object.keys(rootFields).map((root) => `- ${root}:
${rootFields[root].map((field) => describeField(field)).join("\n")}`);
  return [...collections, ...parts].join("\n");
}
function themeCatalogue() {
  const colors = colorRoles.map((role) => `  - ${role}: ${colorRoleLabels[role].label}${colorRoleLabels[role].hint ? ` \u2013 ${colorRoleLabels[role].hint}` : ""}`).join("\n");
  const pairs = contrastPairs.map((pair) => `${pair.text} on ${pair.background} \u2265 ${pair.large ? "3" : "4.5"}:1`).join("; ");
  const fonts2 = fontOptions.map((font) => `${font.family} (${font.category})`).join(", ");
  return `theme.colors \u2013 every value "#RRGGBB":
${colors}
Contrast that must hold (WCAG AA): ${pairs}.
theme.fonts \u2013 ${Object.entries(fontRoleLabels).map(([role, label]) => `${role} (${label})`).join(", ")}: each {family, category}. Only these Google Fonts may be used, with exactly this category: ${fonts2}.`;
}
function assistantInstructions() {
  return `You are Elevate AI, the assistant in the admin panel of a Swedish company's website. The person you talk to owns the company and is not a developer. They describe what they want in Swedish; you answer, and when they want the website changed you change it, but only through the structured content document described below. You never write code, HTML or CSS.

# Language and voice
- Always write to the owner in Swedish: natural, friendly and brief. Plain prose, short paragraphs, "-" bullet lists when listing. **bold** may be used sparingly. No headings, no tables, no emojis.
- Text you write for the website must read as written by a careful Swedish copywriter for this company: concrete, calm, trustworthy, active voice, short sentences, correct Swedish spelling and punctuation. Match the tone and length of the site's existing texts.
- Avoid filler and clich\xE9s ("skr\xE4ddarsydda l\xF6sningar", "vi brinner f\xF6r", "i framkant", "ta ert projekt till n\xE4sta niv\xE5", "oavsett om \u2026"), exclamation marks, rhetorical questions, English loanwords where a Swedish word exists, and em dashes used for drama. Use Swedish conventions: "076-882 03 33", "12 000 kr", dates like "15 mars 2026".
- SEO: write titles about 50\u201360 characters and descriptions about 120\u2013155 characters with the service and the place (G\xF6teborg, Kungsbacka, M\xF6lndal) where it fits naturally. Never stuff keywords.

# Facts
Use only facts that are in the content document or that the owner has given you: the company's name, address, phone, year founded, number of employees, services, certificates, projects. Never invent people, names, roles, quotes, customer reviews, prices, figures, certificates, awards or projects. If a change needs facts you do not have (for example the people in a team section, what customers said, prices), ask the owner for them instead of making them up.

# Limits
You can change the website's content, colours and fonts as described below, and nothing else. You cannot and must not touch sign-in, passwords, users, credits, invoices, quote requests, the reset function, statistics or anything else in the admin panel; if asked, explain kindly that it is done elsewhere in the admin panel (Inst\xE4llningar) or by Elevate Studio. You never publish anything yourself: the owner sees a preview and decides. Change only what the request is about, keep everything else exactly as it is, and never remove content the owner did not ask to remove.

# The content document
The whole site is one JSON document. Its parts: theme (colours, fonts), settings (site name, address, favicon, logo, analytics, maintenance mode), company (name, contact details, address \u2026), navigation (menu), footer, form (the quote form), ui (small texts, many only read out by screen readers), servicePage (texts shared by the service pages), notFound (the 404 page), services, uppdrag (example projects), certificates, pages.
- Lists are collections: {"order": [ids in display order], "items": {id: item}}. Ids are lowercase letters, digits and hyphens, unique within their list, and never change once used. A new item's id should come from its name, e.g. "teamet", "fraga-dranering".
- pages is a collection of pages {slug, title, seo {title, description}, sections}. The start page has slug "". A page's sections is a collection of sections, shown in order. Every section has type, hidden (boolean; hidden sections are kept but not shown), anchor (id for links like "/#kontakt", or "") and label (its name in the admin, usually "") plus the fields of its type.
- Links (href): "/" the start page, "/om-oss" a page, "/tjanster/<service slug>" a service page, "/#<anchor>" a start-page section, "#<anchor>" a section on the same page, "#offert" opens the quote form, or https://, mailto:, tel: addresses. Internal links must lead to something that exists.
- Images: {src, alt, focus?}. You cannot create, search for or fetch images. Use only images that are already in the document, in the image library listed below, or attached by the owner, by copying their src exactly (size variants are added automatically). alt is a short Swedish description of what the image shows. If a change needs a picture you do not have, use a nullable image field's null, or reuse a fitting existing image, and say in imagesNeeded what the owner should upload.
- Icons: one of ${contentIcons.join(", ")}.
- {n}, {total}, {namn} in some texts are filled in by the site; keep them.

## Sections (types for pages.items.<page>.sections)
${sectionCatalogue()}

## The other parts
${partsCatalogue()}

## Colours and fonts
${themeCatalogue()}

# Prices
Changes made by the AI cost the owner credits, by this table (the system computes the exact price; you only classify):
${priceTable.map((row) => `- ${row.action}: ${row.credits}`).join("\n")}`;
}
function assistantContext(site, library) {
  return `# The website now (the draft, including changes the owner has not published yet)
${JSON.stringify(site)}

# The image library (uploaded images not necessarily on the site)
${library.length > 0 ? library.map((image) => `- ${image.src} \u2013 ${image.alt || "(no description)"}`).join("\n") : "(empty)"}`;
}
var planInstructions = `# Your task now: answer and plan
Read the owner's latest message in the light of the conversation and decide:
- "answer": a question, advice or anything that changes nothing. Reply helpfully in "reply". summary "" and items [].
- "clarify": they want a change but something essential is missing or ambiguous (facts you must not invent, which page, which of several things). Ask briefly and concretely in "reply"; summary "" and items [].
- "change": you will change the website. In "reply", say briefly in Swedish what you are going to do (one to three sentences, no price \u2013 the admin shows it). In "summary", one short Swedish sentence describing the change. In "items", list each unit of work with its price category and a short Swedish description, one item per unit: each new page ("page"), each new section ("standardSection" for about, CTA, FAQ, statistics, contact, text and the like; "advancedSection" for team, gallery, price list and reviews with pictures), each item added to or removed from a list ("element", e.g. three new FAQ questions are three items), each section whose text is rewritten ("rewriteSection"), each small text adjustment ("minorText"), colour or font changes ("theme", once), a rebuilt section layout ("layout"), SEO of a page ("seo", per page). Do not list work inside a new section separately.
Keep requests within your limits; if the owner asks for something you cannot do, answer kindly with "answer".`;
var changeInstructions = `# Your task now: make the change
The owner has approved the plan in the conversation. Produce the change set that carries it out exactly: nothing less, nothing more. Write all website text in Swedish following the voice rules.
Operations, applied in order, each on the result of the ones before:
- {"op": "set", "path": [...], "valueJson": "<JSON>"} sets the value at the path. valueJson is the new value encoded as a JSON string, e.g. "\\"Ny rubrik\\"" for a text, "[\\"Stycke ett\\", \\"Stycke tv\xE5\\"]" for paragraphs, or a whole object. Prefer the smallest path that does the job (one field rather than a whole section). path must point inside a part, e.g. ["pages","items","hem","sections","items","hero","heading"] or ["theme","colors","button"].
- {"op": "insert", "path": [path to a list], "id": "new-id", "place": "first" | "last" | "after", "afterId": "<id or empty>", "itemJson": "<JSON of the whole new item>"} adds an item. Lists: ["pages"], ["pages","items",<page>,"sections"], a section's list such as ["pages","items","hem","sections","items","faq","items"], ["services"], ["navigation","menu"] and so on. A new section must have every field of its type, hidden false, label "" and anchor "" unless it should be linked to; its own lists are {"order": [...], "items": {...}} with every item complete.
- {"op": "remove", "path": [path to a list], "id": "<id>"} removes an item.
- {"op": "move", "path": [path to a list], "id": "<id>", "place": ..., "afterId": ...} moves an item.
Use afterId "" unless place is "after". summary: tell the owner in Swedish, in a few sentences or a short list, what you changed and anything they should check. imagesNeeded: Swedish notes of pictures the owner should upload for the change to look its best ([] if none).
Before answering, check: every id you refer to exists (or is new and unique), every value has the type and fields the catalogue gives, texts keep about their recommended lengths, colours keep the required contrast, and links lead somewhere that exists.`;
function retryInstructions(problems) {
  return `Your change set could not be used:
${problems.map((problem) => `- ${problem}`).join("\n")}
Produce the complete change set again with these problems fixed.`;
}
function siteIntro(site) {
  const { company } = site;
  return `This website belongs to ${company.legalName} (${company.shortName}), a company in ${company.city} working in ${company.serviceArea}, founded ${company.foundedYear}.`;
}

// supabase/functions/ai-assistant/index.ts
var MODEL = "claude-opus-5-5";
var MESSAGES_PER_HOUR = 30;
var HISTORY = 24;
var BUCKET = "site-images";
var sendSchema = z3.object({
  action: z3.literal("send"),
  conversationId: z3.string().uuid().nullish(),
  text: z3.string().trim().min(1).max(4e3),
  attachments: z3.array(z3.string().uuid()).max(4).default([])
});
var messageAction = z3.object({ action: z3.enum(["approve", "publish", "discard", "rollback"]), messageId: z3.string().uuid() });
var statusNotes = {
  estimated: "v\xE4ntar p\xE5 \xE4garens godk\xE4nnande",
  generating: "avbr\xF6ts innan den var klar",
  preview: "visas som f\xF6rhandsvisning, inte publicerad",
  published: "publicerad",
  discarded: "\xE5ngrad av \xE4garen innan publicering",
  cancelled: "avbruten",
  failed: "misslyckades, inget \xE4ndrades",
  rolled_back: "publicerades och \xE5ngrades sedan"
};
function anthropic() {
  const apiKey = optionalEnv("ANTHROPIC_API_KEY");
  if (!apiKey) throw new UserError(503, "ai_off", "AI-assistenten \xE4r inte p\xE5slagen \xE4n. Kontakta Elevate Studio.");
  return new Anthropic({ apiKey, baseURL: optionalEnv("ANTHROPIC_API_URL"), maxRetries: 2 });
}
function publicUrl(path) {
  return `${config.supabaseUrl()}/storage/v1/object/public/${BUCKET}/${path}`;
}
function siteImage(row) {
  const sorted = [...row.variants].sort((a, b) => a.width - b.width);
  return {
    src: publicUrl(sorted[sorted.length - 1].path),
    variants: sorted.map((variant) => ({ width: variant.width, src: publicUrl(variant.path) })),
    alt: row.alt_text,
    focus: `${Math.round(row.focal_point.x)}% ${Math.round(row.focal_point.y)}%`,
    imageId: row.id
  };
}
function partialString(source, key) {
  const start = source.indexOf(`"${key}"`);
  if (start < 0) return "";
  const colon = source.indexOf(":", start + key.length + 2);
  const quote = source.indexOf('"', colon + 1);
  if (colon < 0 || quote < 0) return "";
  let out = "";
  for (let i = quote + 1; i < source.length; i++) {
    const char = source[i];
    if (char === '"') return out;
    if (char !== "\\") {
      out += char;
      continue;
    }
    const next = source[i + 1];
    if (next === void 0) return out;
    if (next === "u") {
      const hex = source.slice(i + 2, i + 6);
      if (hex.length < 4) return out;
      out += String.fromCharCode(Number.parseInt(hex, 16));
      i += 5;
    } else {
      out += { n: "\n", t: "	", r: "", b: "", f: "", '"': '"', "\\": "\\", "/": "/" }[next] ?? next;
      i += 1;
    }
  }
  return out;
}
function modelError(error) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "AI-tj\xE4nsten \xE4r inte r\xE4tt inst\xE4lld. Kontakta Elevate Studio.";
  }
  if (error instanceof Anthropic.RateLimitError) return "AI:n har mycket att g\xF6ra just nu. V\xE4nta en minut och f\xF6rs\xF6k igen.";
  if (error instanceof Anthropic.APIConnectionError) return "AI-tj\xE4nsten gick inte att n\xE5. F\xF6rs\xF6k igen om en stund.";
  if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) return "AI-tj\xE4nsten har tillf\xE4lliga problem. F\xF6rs\xF6k igen om en stund.";
  return "N\xE5got gick fel med AI:n. F\xF6rs\xF6k igen.";
}
var Refused = class extends Error {
};
async function callModel(options) {
  const stream = options.client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: options.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: options.effort, format: { type: "json_schema", schema: options.schema } },
      system: options.system,
      messages: options.messages
    },
    { signal: options.signal }
  );
  let text3 = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text3 += event.delta.text;
      options.onText?.(text3);
    }
  }
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Refused();
  if (message.stop_reason === "max_tokens") throw new Error("The answer was cut off (max_tokens)");
  return message.content.flatMap((block) => block.type === "text" ? [block.text] : []).join("");
}
function eventStream(request, run) {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());
  const body = new ReadableStream({
    async start(controller) {
      const send = (event) => {
        if (abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}

`));
        } catch {
          abort.abort();
        }
      };
      try {
        await run(send, abort.signal);
      } catch (error) {
        console.error(error);
        send({ type: "error", message: error instanceof UserError ? error.message : "N\xE5got gick fel. F\xF6rs\xF6k igen." });
      } finally {
        try {
          controller.close();
        } catch {
        }
      }
    },
    cancel() {
      abort.abort();
    }
  });
  return new Response(body, {
    headers: { ...corsHeaders(request), "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" }
  });
}
Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const { user, client: asUser } = await requireAdmin(request);
    const service = serviceClient();
    const body = await readJson(request, 5e4);
    async function loadDraft() {
      const { data, error: error2 } = await asUser.rpc("content_draft");
      if (error2) throw error2;
      return { draft: data.draft, marker: data.marker };
    }
    async function loadLibrary() {
      const { data } = await service.from("website_images").select("id, alt_text, focal_point, variants").order("created_at", { ascending: false }).limit(60);
      return (data ?? []).map(siteImage);
    }
    async function conversationMessages(conversationId) {
      const { data, error: error2 } = await service.from("ai_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      if (error2) throw error2;
      return data ?? [];
    }
    function history(rows) {
      const recent = rows.slice(-HISTORY);
      while (recent.length > 0 && recent[0].role !== "user") recent.shift();
      return recent.map((row2) => {
        if (row2.role === "user") {
          const images = row2.attachments.map((attachment) => ({ type: "image", source: { type: "url", url: attachment.src } }));
          const list2 = row2.attachments.length ? `

Bifogade bilder (anv\xE4nd src exakt):
${row2.attachments.map((attachment) => `- src ${attachment.src} \u2013 ${attachment.alt}`).join("\n")}` : "";
          return { role: "user", content: [...images, { type: "text", text: row2.content + list2 }] };
        }
        const note = row2.plan?.kind === "change" ? `

[F\xF6rslag: ${row2.plan.summary} \u2013 ${statusNotes[row2.status] ?? row2.status}]` : "";
        return { role: "assistant", content: (row2.change_set?.summary ?? row2.content) + note };
      });
    }
    function system(draft, library, mode) {
      return [
        { type: "text", text: assistantInstructions(), cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: `${siteIntro(draft)}

${assistantContext(compactForModel(draft), library.map((image) => ({ src: image.src, alt: image.alt })))}`,
          cache_control: { type: "ephemeral" }
        },
        { type: "text", text: mode }
      ];
    }
    async function loadMessage(id) {
      const { data, error: error2 } = await service.from("ai_messages").select("*").eq("id", id).maybeSingle();
      if (error2) throw error2;
      if (!data || data.role !== "assistant") throw new UserError(404, "not_found", "F\xF6rslaget finns inte l\xE4ngre.");
      return data;
    }
    if (body.action === "send") {
      const parsed2 = sendSchema.safeParse(body);
      if (!parsed2.success) throw new UserError(400, "invalid", "Skriv ett meddelande (h\xF6gst 4 000 tecken).");
      const { text: text3, attachments } = parsed2.data;
      const hourAgo = new Date(Date.now() - 36e5).toISOString();
      const { count } = await service.from("ai_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", hourAgo);
      if ((count ?? 0) >= MESSAGES_PER_HOUR) {
        throw new UserError(429, "rate_limited", `Du har skickat ${MESSAGES_PER_HOUR} meddelanden den senaste timmen. V\xE4nta en stund och skriv sedan igen.`);
      }
      const client = anthropic();
      let conversationId = parsed2.data.conversationId ?? null;
      if (conversationId) {
        const { data } = await service.from("ai_conversations").select("id").eq("id", conversationId).maybeSingle();
        if (!data) throw new UserError(404, "not_found", "Konversationen finns inte l\xE4ngre.");
      } else {
        const title = text3.replace(/\s+/g, " ").slice(0, 60) + (text3.length > 60 ? "\u2026" : "");
        const { data, error: error2 } = await service.from("ai_conversations").insert({ title, created_by: user.id }).select("id").single();
        if (error2) throw error2;
        conversationId = data.id;
      }
      let attached = [];
      if (attachments.length > 0) {
        const { data } = await service.from("website_images").select("id, alt_text, focal_point, variants").in("id", attachments);
        attached = (data ?? []).map((row2) => {
          const image = siteImage(row2);
          return { imageId: row2.id, src: image.src, alt: image.alt };
        });
      }
      const { data: userRow, error: userError } = await service.from("ai_messages").insert({ conversation_id: conversationId, role: "user", content: text3, attachments: attached }).select("*").single();
      if (userError) throw userError;
      const [{ draft }, library, rows] = await Promise.all([loadDraft(), loadLibrary(), conversationMessages(conversationId)]);
      return eventStream(request, async (send, signal) => {
        send({ type: "start", conversationId, message: userRow });
        let reply = "";
        let raw;
        try {
          raw = await callModel({
            client,
            system: system(draft, library, planInstructions),
            messages: history(rows),
            schema: planJsonSchema,
            effort: "low",
            maxTokens: 8e3,
            signal,
            onText: (soFar) => {
              const next = partialString(soFar, "reply");
              if (next.length > reply.length) {
                send({ type: "reply", text: next.slice(reply.length) });
                reply = next;
              }
            }
          });
        } catch (error3) {
          const cancelled = signal.aborted || error3 instanceof Anthropic.APIUserAbortError;
          const content = cancelled ? "Avbrutet." : error3 instanceof Refused ? "Det kan jag tyv\xE4rr inte hj\xE4lpa till med." : modelError(error3);
          const { data: row3 } = await service.from("ai_messages").insert({ conversation_id: conversationId, role: "assistant", content, status: cancelled ? "cancelled" : "failed" }).select("*").single();
          if (!cancelled) console.error(error3);
          send({ type: "done", message: row3 });
          return;
        }
        const plan = planSchema.safeParse(JSON.parse(raw));
        if (!plan.success) {
          const { data: row3 } = await service.from("ai_messages").insert({ conversation_id: conversationId, role: "assistant", content: "Jag f\xF6rstod inte riktigt. Kan du beskriva det p\xE5 ett annat s\xE4tt?", status: "failed" }).select("*").single();
          send({ type: "done", message: row3 });
          return;
        }
        const price = priceOfPlan(plan.data);
        const isChange = plan.data.kind === "change" && plan.data.items.length > 0;
        const { data: row2, error: error2 } = await service.from("ai_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: plan.data.reply,
          plan: { ...plan.data, lines: price.lines, total: price.total },
          credit_cost: isChange ? price.total : 0,
          status: isChange ? "estimated" : "done"
        }).select("*").single();
        if (error2) throw error2;
        await service.from("ai_conversations").update({ updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", conversationId);
        send({ type: "done", message: row2 });
      });
    }
    const parsed = messageAction.safeParse(body);
    if (!parsed.success) throw new UserError(400, "invalid", "Ogiltig f\xF6rfr\xE5gan.");
    const message = await loadMessage(parsed.data.messageId);
    if (parsed.data.action === "approve") {
      const stale = message.status === "generating" && Date.now() - new Date(message.created_at).getTime() > 10 * 6e4;
      if (message.status !== "estimated" && !stale) throw new UserError(409, "not_estimated", "F\xF6rslaget har redan hanterats.");
      if (!message.plan) throw new UserError(409, "no_plan", "F\xF6rslaget saknar en plan.");
      const { data: balance } = await service.from("credit_balance").select("balance").eq("account_id", "site").maybeSingle();
      if ((balance?.balance ?? 0) < message.credit_cost) {
        throw new UserError(402, "insufficient_credits", "Du har inte tillr\xE4ckligt med credits f\xF6r den h\xE4r \xE4ndringen. Fyll p\xE5 under Inst\xE4llningar \u2192 Credits.");
      }
      const client = anthropic();
      await service.from("ai_messages").update({ status: "generating" }).eq("id", message.id);
      const [{ draft, marker }, library, rows] = await Promise.all([loadDraft(), loadLibrary(), conversationMessages(message.conversation_id)]);
      const known = imagesBySrc(draft);
      for (const image of library) known.set(image.src, image);
      const upTo = rows.findIndex((row2) => row2.id === message.id);
      const plan = message.plan;
      const approval = `Jag godk\xE4nner f\xF6rslaget. Genomf\xF6r det nu: ${plan.summary}
${plan.items.map((item) => `- ${item.description}`).join("\n")}`;
      const messages = [...history(rows.slice(0, upTo + 1)), { role: "user", content: approval }];
      return eventStream(request, async (send, signal) => {
        const fail = async (status, content) => {
          const { data: row2 } = await service.from("ai_messages").update({ status, content: `${message.content}

${content}` }).eq("id", message.id).select("*").single();
          send({ type: "done", message: row2 });
        };
        let attempt = 0;
        let reported = 0;
        let lastProblems = [];
        let conversation = messages;
        while (attempt < 2) {
          attempt++;
          send({ type: "status", text: attempt === 1 ? "G\xF6r \xE4ndringen\u2026" : "R\xE4ttar till f\xF6rslaget\u2026" });
          let raw;
          try {
            raw = await callModel({
              client,
              system: system(draft, library, changeInstructions),
              messages: conversation,
              schema: changeSetJsonSchema,
              effort: "medium",
              maxTokens: 32e3,
              signal,
              onText: (soFar) => {
                if (soFar.length - reported >= 400) {
                  reported = soFar.length;
                  send({ type: "progress", chars: soFar.length });
                }
              }
            });
          } catch (error2) {
            if (signal.aborted || error2 instanceof Anthropic.APIUserAbortError) return fail("cancelled", "Avbrutet \u2013 inget \xE4ndrades och inga credits drogs.");
            if (error2 instanceof Refused) return fail("failed", "Den \xE4ndringen kan jag tyv\xE4rr inte g\xF6ra. Inga credits drogs.");
            console.error(error2);
            return fail("failed", `${modelError(error2)} Inga credits drogs.`);
          }
          send({ type: "status", text: "Kontrollerar \xE4ndringen\u2026" });
          let changeSet = null;
          try {
            const checked = changeSetSchema.safeParse(JSON.parse(raw));
            if (checked.success) changeSet = checked.data;
            else lastProblems = checked.error.issues.slice(0, 10).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
          } catch {
            lastProblems = ["The answer was not valid JSON."];
          }
          if (changeSet) {
            const applied = applyChangeSet(draft, changeSet.operations, known);
            if (applied.doc && applied.problems.length === 0) {
              const price = priceChangeSet(draft, applied.doc, changeSet.operations);
              const cost = Math.min(price.total, message.credit_cost);
              const stored = {
                ...changeSet,
                patches: applied.patches,
                marker,
                lines: price.lines,
                computedTotal: price.total,
                changes: Array.from(new Set(applied.patches.map((patch) => describePath(applied.doc, patch.path.slice(0, Math.min(patch.path.length, 9)))))).slice(0, 30)
              };
              const { data: row2, error: error2 } = await service.from("ai_messages").update({ status: "preview", change_set: stored, credit_cost: cost }).eq("id", message.id).select("*").single();
              if (error2) throw error2;
              await audit("ai.preview", message.id, null, { cost, operations: changeSet.operations.length }, user.id);
              send({ type: "done", message: row2 });
              return;
            }
            lastProblems = applied.problems;
          }
          conversation = [...messages, { role: "assistant", content: raw }, { role: "user", content: retryInstructions(lastProblems) }];
        }
        console.error("change set rejected twice", lastProblems);
        await fail("failed", "Jag kunde inte g\xF6ra \xE4ndringen s\xE5 att den h\xE5ller m\xE5ttet, s\xE5 inget \xE4ndrades och inga credits drogs. Prova att beskriva den lite annorlunda eller dela upp den i mindre steg.");
      });
    }
    if (parsed.data.action === "discard") {
      if (message.status !== "estimated" && message.status !== "preview") throw new UserError(409, "not_open", "F\xF6rslaget har redan hanterats.");
      const { data: row2 } = await service.from("ai_messages").update({ status: "discarded" }).eq("id", message.id).select("*").single();
      await audit("ai.discarded", message.id, null, null, user.id);
      return json(request, { message: row2 });
    }
    if (parsed.data.action === "publish") {
      if (message.status !== "preview" || !message.change_set) throw new UserError(409, "not_preview", "F\xF6rslaget kan inte publiceras l\xE4ngre.");
      const stored = message.change_set;
      for (let attempt = 0; attempt < 2; attempt++) {
        let { patches } = stored;
        const { draft, marker } = await loadDraft();
        if (marker !== stored.marker) {
          const known = imagesBySrc(draft);
          for (const image of await loadLibrary()) known.set(image.src, image);
          const applied = applyChangeSet(draft, stored.operations, known);
          if (!applied.doc) {
            throw new UserError(409, "outdated", "Hemsidan har \xE4ndrats sedan f\xF6rslaget gjordes, s\xE5 det g\xE5r inte att publicera l\xE4ngre. Be AI:n om ett nytt f\xF6rslag.");
          }
          patches = applied.patches;
        }
        const { data: result2, error: error2 } = await service.rpc("publish_ai_change", {
          p_message_id: message.id,
          p_marker: marker,
          p_patches: patches,
          p_cost: message.credit_cost,
          p_summary: stored.summary.slice(0, 480),
          p_actor: user.id
        });
        if (error2) throw error2;
        if (result2.status === "changed") continue;
        if (result2.status === "insufficient_credits") throw new UserError(402, "insufficient_credits", "Du har inte tillr\xE4ckligt med credits. Fyll p\xE5 under Inst\xE4llningar \u2192 Credits.");
        if (result2.status !== "published") throw new UserError(409, "not_preview", "F\xF6rslaget kan inte publiceras l\xE4ngre.");
        const deploy2 = await triggerDeploy(result2.version);
        await audit("ai.published", message.id, null, { version: result2.version, cost: message.credit_cost }, user.id);
        const { data: row2 } = await service.from("ai_messages").select("*").eq("id", message.id).single();
        return json(request, { message: row2, version: result2.version, balance: result2.balance, deploy: deploy2 });
      }
      throw new UserError(409, "busy", "Hemsidan \xE4ndrades precis samtidigt. F\xF6rs\xF6k igen.");
    }
    const { data: result, error } = await service.rpc("rollback_ai_change", { p_message_id: message.id, p_actor: user.id });
    if (error) throw error;
    if (result.status === "not_latest") {
      throw new UserError(409, "not_latest", "Hemsidan har publicerats igen efter den h\xE4r \xE4ndringen. Anv\xE4nd Versionshistorik under Inst\xE4llningar f\xF6r att g\xE5 tillbaka.");
    }
    if (result.status !== "rolled_back") throw new UserError(409, "not_published", "\xC4ndringen g\xE5r inte att \xE5ngra.");
    const deploy = await triggerDeploy(result.version);
    const { data: row } = await service.from("ai_messages").select("*").eq("id", message.id).single();
    return json(request, { message: row, version: result.version, balance: result.balance, deploy });
  })
);
