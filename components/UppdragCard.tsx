import { Photo } from "./Photo";
import { SiteLink } from "./SiteLink";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { Uppdrag } from "@/lib/site/schema.ts";

export function UppdragCard({ item }: { item: Uppdrag }) {
  return (
    <SiteLink
      href={item.href}
      className="group relative block aspect-[4/5] overflow-hidden bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <Photo
        {...imageProps(item.image, "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 85vw")}
        alt={item.image.alt}
        className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.04]"
        transition="transform 700ms ease-out"
        style={focusStyle(item.image)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/25" aria-hidden="true" />
      <span className="absolute left-0 top-0 bg-accent px-4 py-[11px] text-tag uppercase text-on-primary">{item.tag}</span>
      <h3 className="absolute inset-x-0 bottom-8 px-6 text-center text-[26px] font-semibold leading-tight text-white sm:bottom-10">
        {item.title}
      </h3>
    </SiteLink>
  );
}
