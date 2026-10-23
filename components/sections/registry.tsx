import type { ComponentType } from "react";
import type { SectionType } from "@/lib/site/schema.ts";
import type { SectionProps } from "./types";
import { AboutIntroSection } from "./AboutIntroSection";
import { AreaSection } from "./AreaSection";
import { BeforeAfterSection } from "./BeforeAfterSection";
import { OverlaySection } from "./OverlaySection";
import { ValuesSection } from "./ValuesSection";
import { AboutSection } from "./AboutSection";
import { BandSection } from "./BandSection";
import { CertificatesSection } from "./CertificatesSection";
import { ContactSection } from "./ContactSection";
import { CtaSection } from "./CtaSection";
import { FaqSection } from "./FaqSection";
import { FeatureSection } from "./FeatureSection";
import { GallerySection } from "./GallerySection";
import { HeroSection } from "./HeroSection";
import { MapSection } from "./MapSection";
import { PageHeroSection } from "./PageHeroSection";
import { PhotoPairSection } from "./PhotoPairSection";
import { PricelistSection } from "./PricelistSection";
import { ProcessSection } from "./ProcessSection";
import { PromoSection } from "./PromoSection";
import { ServicesSection } from "./ServicesSection";
import { StatsSection } from "./StatsSection";
import { TeamSection } from "./TeamSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { TextSection } from "./TextSection";
import { UppdragCarouselSection } from "./UppdragCarouselSection";
import { UppdragGridSection } from "./UppdragGridSection";
import { TimelineSection } from "./TimelineSection";
import { ModelSection } from "./ModelSection";

export const sectionComponents: { [T in SectionType]: ComponentType<SectionProps<T>> } = {
  hero: HeroSection,
  services: ServicesSection,
  uppdragCarousel: UppdragCarouselSection,
  stats: StatsSection,
  feature: FeatureSection,
  promo: PromoSection,
  about: AboutSection,
  process: ProcessSection,
  faq: FaqSection,
  contact: ContactSection,
  map: MapSection,
  pageHero: PageHeroSection,
  aboutIntro: AboutIntroSection,
  photoPair: PhotoPairSection,
  band: BandSection,
  certificates: CertificatesSection,
  uppdragGrid: UppdragGridSection,
  cta: CtaSection,
  team: TeamSection,
  gallery: GallerySection,
  pricelist: PricelistSection,
  testimonials: TestimonialsSection,
  text: TextSection,
  overlay: OverlaySection,
  beforeAfter: BeforeAfterSection,
  values: ValuesSection,
  area: AreaSection,
  timeline: TimelineSection,
  model: ModelSection,
};

/** Sections that end without bottom space of their own, so the section after them can carry straight on. */
export const flushBottom = new Set<SectionType>(["aboutIntro"]);

/** Sections that can carry straight on from a flush one before them. */
export const attachesTop = new Set<SectionType>(["cta", "photoPair"]);

/** Sections that open a subpage with the breadcrumb trail and the page's main heading. */
export const opensPage = new Set<SectionType>(["pageHero", "aboutIntro", "certificates", "uppdragGrid"]);
