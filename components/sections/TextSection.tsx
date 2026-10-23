import { Reveal } from "../Reveal";
import { SiteLink } from "../SiteLink";
import { buttonClasses } from "../Button";
import { ZoomImage } from "../ZoomImage";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

const tones = {
  light: { section: "", heading: "text-heading", text: "text-body", button: "solid" },
  card: { section: "bg-card", heading: "text-heading", text: "text-body", button: "solid" },
  primary: { section: "bg-primary text-on-primary", heading: "", text: "", button: "on-primary" },
} as const;

/** Free text: a heading, paragraphs, an optional photo beside them and an optional button. */
export function TextSection({ section }: SectionProps<"text">) {
  const tone = tones[section.tone];
  const image = section.image;

  return (
    <section id={section.anchor || undefined} className={`scroll-mt-20 ${tone.section}`}>
      <div
        className={`mx-auto grid max-w-content grid-cols-1 gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:gap-16 lg:px-8 lg:py-28 ${
          image ? "lg:grid-cols-2" : ""
        }`}
      >
        <Reveal className={`max-w-3xl ${image && section.imageSide === "left" ? "lg:order-2" : ""}`}>
          {section.heading && <h2 className={`text-h2 lg:text-h2-lg ${tone.heading}`}>{section.heading}</h2>}
          <div className="mt-5 space-y-4">
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className={`text-copy lg:text-lead ${tone.text}`}>
                {paragraph}
              </p>
            ))}
          </div>
          {section.button && section.button.label && (
            <SiteLink href={section.button.href} className={buttonClasses(tone.button, "mt-8")}>
              {section.button.label}
            </SiteLink>
          )}
        </Reveal>

        {image && (
          <Reveal delayMs={120}>
            <div className="relative aspect-[4/3] overflow-hidden bg-primary/20">
              <ZoomImage
                {...imageProps(image, "(min-width: 1280px) 600px, (min-width: 1024px) 50vw, 100vw")}
                alt={image.alt}
                loading="lazy"
                style={focusStyle(image)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
