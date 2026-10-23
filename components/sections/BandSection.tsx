import { SiteLink } from "../SiteLink";
import { buttonClasses } from "../Button";
import { ZoomImage } from "../ZoomImage";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

/** A text block in the primary colour, a full-width photo and another text block — one continuous band. */
export function BandSection({ section }: SectionProps<"band">) {
  return (
    <section id={section.anchor || undefined} className="bg-primary text-on-primary">
      <div className="mx-auto max-w-content px-6 pb-6 pt-12 lg:px-8 lg:pb-16 lg:pt-24">
        <div className="max-w-3xl">
          <h2 className="text-h2 lg:text-h2-lg">{section.heading}</h2>
          {section.text && <p className="mt-4 text-copy lg:mt-6 lg:text-lead">{section.text}</p>}
          {section.link.label && (
            <SiteLink href={section.link.href} className={buttonClasses("on-primary", "mt-6 lg:mt-8")}>
              {section.link.label}
            </SiteLink>
          )}
        </div>
      </div>

      <div className="relative aspect-[3/2] w-full overflow-clip bg-secondary sm:aspect-[2/1] lg:aspect-auto lg:h-[min(60vh,620px)]">
        <ZoomImage
          {...imageProps(section.image, "100vw")}
          alt={section.image.alt}
          loading="lazy"
          parallax="band"
          style={focusStyle(section.image)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="mx-auto max-w-content px-6 pb-16 pt-6 lg:px-8 lg:pb-24 lg:pt-16">
        <div className="max-w-3xl">
          <h2 className="text-h2 lg:text-h2-lg">{section.secondHeading}</h2>
          {section.secondText && <p className="mt-4 text-copy lg:mt-6 lg:text-lead">{section.secondText}</p>}
          {section.secondLink.label && (
            <SiteLink href={section.secondLink.href} className={buttonClasses("on-primary", "mt-6 lg:mt-8")}>
              {section.secondLink.label}
            </SiteLink>
          )}
        </div>
      </div>
    </section>
  );
}
