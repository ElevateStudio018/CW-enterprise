import { Reveal } from "../Reveal";
import { SiteLink } from "../SiteLink";
import { UppdragCarousel } from "../UppdragCarousel";
import { ArrowLabel, arrowLinkClasses } from "../Button";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

export function UppdragCarouselSection({ section, ctx }: SectionProps<"uppdragCarousel">) {
  const { ui } = ctx.site;
  return (
    <section id={section.anchor || undefined} className="pb-10 pt-16 sm:pb-14 sm:pt-20 lg:pb-20 lg:pt-28">
      <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <h2 className="text-h2 text-heading lg:text-h2-lg">{section.heading}</h2>
          {section.text && <p className="mt-5 text-copy text-body lg:text-lead">{section.text}</p>}
          {section.link.label && (
            <SiteLink href={section.link.href} className={arrowLinkClasses("mt-6")}>
              <ArrowLabel>{section.link.label}</ArrowLabel>
            </SiteLink>
          )}
        </Reveal>
      </div>

      {/* No side padding on mobile: the carousel centres the current card itself, with its neighbours peeking in. */}
      <div className="mx-auto mt-10 max-w-content sm:px-6 lg:px-8">
        <UppdragCarousel
          items={list(ctx.site.uppdrag)}
          labels={{ previous: ui.carouselPrevious, next: ui.carouselNext, goTo: ui.carouselGoTo }}
        />
      </div>
    </section>
  );
}
