import { Btn, CallBtn, Eyebrow } from "../vk/parts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

/** The start page's top: a photo filling the screen under the menu, the heading, a line of text and two buttons. */
export function HeroSection({ section, ctx }: SectionProps<"hero">) {
  const { company, ui } = ctx.site;
  return (
    <section id={section.anchor || undefined} className="hero hero-home">
      <div className="hero-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...imageProps(section.image, "100vw")} alt={section.image.alt} style={focusStyle(section.image)} fetchPriority="high" />
      </div>
      <div className="wrap hero-in">
        <Eyebrow text={section.eyebrow} />
        <h1>{section.heading}</h1>
        {section.text && <p className="hero-lead">{section.text}</p>}
        <div className="btns">
          <Btn link={section.button} kind="blue" arrow />
          <CallBtn phone={company.phone} prefix={ui.callPrefix} />
        </div>
      </div>
    </section>
  );
}
