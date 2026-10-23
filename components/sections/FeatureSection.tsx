import { Reveal } from "../Reveal";
import { DrawIcon } from "../DrawIcon";
import { Photo } from "../Photo";
import { SiteLink } from "../SiteLink";
import { ArrowLabel, buttonClasses } from "../Button";
import { ZoomImage } from "../ZoomImage";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

export function FeatureSection({ section }: SectionProps<"feature">) {
  const cards = list(section.cards);
  return (
    <section id={section.anchor || undefined}>
      {/* Photo band: heading on the darker left side, the work itself on the right. */}
      <div className="relative isolate overflow-clip bg-secondary text-white">
        <ZoomImage
          {...imageProps(section.image, "100vw")}
          alt={section.image.alt}
          loading="lazy"
          parallax="band"
          style={focusStyle(section.image)}
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[72%_35%] lg:object-[60%_75%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/60 to-black/45 lg:via-black/45 lg:to-black/5"
        />

        <div className="mx-auto max-w-content px-4 pb-24 pt-14 sm:px-6 lg:px-8 lg:pb-44 lg:pt-24">
          <Reveal className="max-w-[560px] lg:max-w-[640px]">
            <h2 className="text-balance text-display lg:text-[56px] lg:leading-[1.06]">{section.heading}</h2>
            {section.text && <p className="mt-4 text-copy text-white/90 lg:mt-6 lg:text-lead">{section.text}</p>}
          </Reveal>
        </div>
      </div>

      {/* The points as cards that overlap the bottom of the photo band. */}
      <div className="relative mx-auto -mt-12 max-w-content px-3 sm:px-6 lg:-mt-28 lg:px-8">
        <div className={`grid gap-4 lg:gap-6 ${cards.length > 1 ? "xl:grid-cols-2" : ""}`}>
          {cards.map((card, index) => (
            <Reveal key={card.id} delayMs={index * 100} className="h-full">
              <article className="flex h-full flex-col bg-card sm:flex-row">
                <div className="flex flex-1 flex-col p-6 sm:p-8 lg:p-10">
                  <div className="flex items-center gap-4">
                    <DrawIcon
                      name={card.icon}
                      delayMs={150 + index * 60}
                      className="flex h-12 w-12 shrink-0 items-center justify-center bg-accent text-on-primary"
                      iconClassName="h-6 w-6"
                    />
                    <h3 className="text-h3 text-heading">{card.heading}</h3>
                  </div>
                  <p className="mt-5 text-copy leading-[1.4] text-body">{card.text}</p>
                  {card.link.label && (
                    <div className="mt-auto pt-7">
                      <SiteLink href={card.link.href} className={buttonClasses("solid", "group/arrow")}>
                        <span>
                          <ArrowLabel spaced>{card.link.label}</ArrowLabel>
                        </span>
                      </SiteLink>
                    </div>
                  )}
                </div>

                {/* Beside the text, cut on the diagonal along its left edge. Left out on phones, where the cards follow straight on. */}
                <div className="relative hidden sm:block sm:w-[40%] sm:shrink-0 sm:[clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]">
                  <Photo
                    {...imageProps(card.image, "(min-width: 1280px) 260px, 40vw")}
                    alt={card.image.alt}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={focusStyle(card.image)}
                  />
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
