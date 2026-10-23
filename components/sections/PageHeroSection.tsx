import Link from "next/link";
import { Btn, CallBtn, Eyebrow } from "../vk/parts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { Crumb } from "../Breadcrumbs";
import type { SectionProps } from "./types";

/** A subpage's top: a wide photo with the breadcrumb trail, the page's main heading, a line of text and buttons. */
export function PageHeroSection({ section, ctx }: SectionProps<"pageHero">) {
  const { company, ui } = ctx.site;
  return (
    <section id={section.anchor || undefined} className={`hero${section.size === "tall" ? " hero-tall" : ""}`}>
      <div className="hero-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...imageProps(section.image, "100vw")} alt={section.image.alt} style={focusStyle(section.image)} fetchPriority="high" />
      </div>
      <div className="wrap hero-in">
        {ctx.breadcrumbs && <HeroCrumbs items={ctx.breadcrumbs} label={ui.breadcrumbsLabel} />}
        <Eyebrow text={section.eyebrow} />
        {section.heading && <h1>{section.heading}</h1>}
        {section.text && <p className="hero-lead">{section.text}</p>}
        {section.button.label && (
          <div className="btns">
            <Btn link={section.button} kind="blue" arrow />
            <CallBtn phone={company.phone} prefix={ui.callPrefix} />
          </div>
        )}
      </div>
    </section>
  );
}

/** "Start / Tjänster / Badrum" over a photo. */
export function HeroCrumbs({ items, label }: { items: Crumb[]; label: string }) {
  return (
    <nav className="crumbs" aria-label={label}>
      {items.map((item, index) => (
        <span key={`${index}-${item.label}`}>
          {index > 0 && " / "}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
