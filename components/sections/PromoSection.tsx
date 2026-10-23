import { SiteLink } from "../SiteLink";
import { Topography } from "../Topography";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

// Which side the box sits on (desktop) and where the contour pattern is anchored.
const sideClasses = {
  left: { box: "lg:mr-auto lg:ml-12", pattern: "left-[36%] top-full" },
  right: { box: "lg:ml-auto lg:mr-12", pattern: "left-[76%] top-[88%]" },
} as const;

/** Thin outline pill; wrapped labels stay left-aligned like the single-line ones. */
const promoPillClasses =
  "mt-6 inline-flex max-w-full items-center rounded-full border-[1.5px] border-on-primary px-8 py-4 text-left text-label uppercase text-on-primary transition-colors duration-200 hover:bg-on-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary";

export function PromoSection({ section }: SectionProps<"promo">) {
  return (
    <section id={section.anchor || undefined} className="py-14 lg:py-24">
      <div className="mx-auto max-w-content space-y-8 sm:px-6 lg:space-y-20 lg:px-8">
        {list(section.boxes).map((box) => {
          const classes = sideClasses[box.side];
          return (
            <div key={box.id}>
              <div className="aspect-[2/1] w-full overflow-hidden bg-primary/20 lg:aspect-[21/9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  {...imageProps(box.image, "(min-width: 1280px) 1216px, 100vw")}
                  alt={box.image.alt}
                  loading="lazy"
                  style={focusStyle(box.image)}
                  className="h-full w-full object-cover"
                />
              </div>
              <div
                className={`relative mx-2 -mt-12 overflow-hidden bg-primary px-8 pb-8 pt-7 text-on-primary sm:mx-6 lg:-mt-48 lg:w-[46%] lg:p-12 ${classes.box}`}
              >
                <Topography
                  className={`pointer-events-none absolute h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 text-on-primary/[0.09] ${classes.pattern}`}
                />
                <div className="relative">
                  <h2 className="text-h2 lg:text-[38px] lg:leading-[1.12]">{box.heading}</h2>
                  {box.text && <p className="mt-3 text-copy lg:mt-4 lg:text-lead">{box.text}</p>}
                  {box.link.label && (
                    <SiteLink href={box.link.href} className={promoPillClasses}>
                      {box.link.label}
                    </SiteLink>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
