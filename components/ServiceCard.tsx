import Link from "next/link";
import { ArrowLabel } from "./Button";
import { Photo } from "./Photo";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { Service } from "@/lib/site/schema.ts";

export function ServiceCard({ service, linkPrefix, wide = false }: { service: Service; linkPrefix: string; wide?: boolean }) {
  return (
    // On hover a thin line also slides in along the bottom of the card, like the line under the links.
    <Link
      href={`/tjanster/${service.slug}`}
      className="group group/arrow relative flex h-full flex-col bg-card after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <div className={`relative overflow-hidden bg-primary/20 ${wide ? "aspect-[2/1]" : "aspect-[4/3] sm:aspect-square"}`}>
        <Photo
          {...imageProps(service.image, wide ? "(min-width: 1280px) 50vw, 100vw" : "(min-width: 1280px) 33vw, 50vw")}
          alt={service.image.alt}
          className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.04]"
          transition="transform 700ms ease-out"
          style={focusStyle(service.image)}
        />
      </div>
      {/* Phones fit two cards to a row: just the name there, the "Läs mer om …" link from sm up. */}
      <div className="flex flex-1 flex-col justify-between gap-6 px-3 py-3 sm:px-8 sm:py-8">
        {/* The longest word ("Totalentreprenad") fits from 360 px wide; narrower than that it breaks, hyphenated where
            the browser can. */}
        <h3 className="text-[15px] font-semibold leading-snug text-heading max-sm:hyphens-auto max-sm:[overflow-wrap:anywhere] sm:text-h3">
          {service.name}
        </h3>
        {linkPrefix && (
          <span className="hidden text-label uppercase text-heading transition-colors duration-200 group-hover:text-accent sm:block">
            <ArrowLabel spaced>{`${linkPrefix} ${service.name}`}</ArrowLabel>
          </span>
        )}
      </div>
    </Link>
  );
}
