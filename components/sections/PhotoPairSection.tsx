import { ZoomImage } from "../ZoomImage";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

/** Two photos side by side, closing off the section before it or standing on their own. */
export function PhotoPairSection({ section, ctx }: SectionProps<"photoPair">) {
  return (
    <div
      id={section.anchor || undefined}
      className={`mx-auto max-w-content px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24 ${ctx.attached ? "" : "pt-4 lg:pt-8"}`}
    >
      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 lg:mt-16">
        {list(section.photos).map((photo) => (
          <div key={photo.id} className="relative aspect-[4/5] overflow-hidden bg-primary/20 sm:aspect-[4/3]">
            <ZoomImage
              {...imageProps(photo.image, "(min-width: 1280px) 600px, 50vw")}
              alt={photo.image.alt}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              style={focusStyle(photo.image)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
