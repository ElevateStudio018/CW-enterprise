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

// supabase/functions/_shared/validate.ts
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
function getAt(doc, path) {
  let node = doc;
  for (const key of path) {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return void 0;
    node = node[key];
  }
  return node;
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
function summarize(doc, paths, extra = []) {
  const names = Array.from(/* @__PURE__ */ new Set([...extra, ...paths.map((path) => describePath(doc, path))]));
  if (names.length === 0) return "Inga \xE4ndringar";
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} och ${names.length - 3} till` : shown;
}

// supabase/functions/_shared/validate.ts
z2.config(z2.locales.sv());
function validateSite(doc) {
  const parsed = siteDataSchema.safeParse(doc);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.slice(0, 20).map((issue) => {
      const path = issue.path.map(String);
      return { path, where: describePath(doc, path), message: issue.message };
    })
  };
}
function sameDocument(a, b) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value !== null && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

// supabase/functions/publish/index.ts
Deno.serve(
  handle(async (request) => {
    if (request.method !== "POST") throw new UserError(405, "method", "Fel metod.");
    const { user, client } = await requireAdmin(request);
    const body = await readJson(request);
    if (body.action === "redeploy") {
      const { data, error } = await client.from("site_snapshot").select("version").eq("id", 1).single();
      if (error) throw error;
      return json(request, { status: "redeploy", version: data.version, deploy: await triggerDeploy(data.version) });
    }
    const { data: current, error: draftError } = await client.rpc("content_draft");
    if (draftError) throw draftError;
    if (current.changes === 0 && !current.themeChanged) {
      throw new UserError(409, "nothing_to_publish", "Det finns inga \xE4ndringar att publicera.");
    }
    const checked = validateSite(current.draft);
    if (!checked.ok) {
      return json(request, { error: "invalid_content", message: "N\xE5gra f\xE4lt beh\xF6ver r\xE4ttas innan du kan publicera.", issues: checked.issues }, 422);
    }
    const { data: rows, error: rowsError } = await client.from("website_content").select("path");
    if (rowsError) throw rowsError;
    const summary = summarize(current.draft, (rows ?? []).map((row) => row.path), current.themeChanged ? ["F\xE4rger och typsnitt"] : []);
    const { data: result, error: publishError } = await client.rpc("publish_draft", { p_marker: current.marker, p_summary: summary });
    if (publishError) throw publishError;
    if (result.status === "changed") {
      throw new UserError(409, "changed", "N\xE5got \xE4ndrades precis medan du publicerade. F\xF6rs\xF6k igen.");
    }
    const service = serviceClient();
    const { data: published } = await service.from("site_snapshot").select("version, data").eq("id", 1).single();
    if (!published || published.version !== result.version || !sameDocument(published.data, current.draft)) {
      await service.from("site_snapshot").update({ data: current.draft }).eq("id", 1).eq("version", result.version);
      await audit("content.publish_repaired", `version ${result.version}`, published?.data ?? null, current.draft, user.id);
    }
    const deploy = await triggerDeploy(result.version);
    return json(request, { status: "published", version: result.version, revisionId: result.revisionId, summary, deploy });
  })
);
