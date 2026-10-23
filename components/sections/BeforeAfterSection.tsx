import { MoreLink, SecHead } from "../vk/parts";
import { focusStyle, imageProps, withBasePath } from "@/lib/site/images.ts";
import type { SiteImage } from "@/lib/site/schema.ts";
import type { SectionProps } from "./types";

/** Two photos side by side, labelled before and after; each opens large. */
export function BeforeAfterSection({ section, id }: SectionProps<"beforeAfter">) {
  return (
    <section id={section.anchor || undefined} className="sec tint">
      <div className="wrap">
        <SecHead eyebrow={section.eyebrow} heading={section.heading} right={<MoreLink link={section.link} />} />
        <BeforeAfter group={`ba-${id}`} before={section.before} beforeLabel={section.beforeLabel} after={section.after} afterLabel={section.afterLabel} />
      </div>
    </section>
  );
}

export function BeforeAfter(props: { group: string; before: SiteImage; beforeLabel: string; after: SiteImage; afterLabel: string }) {
  const photos = [
    { image: props.before, label: props.beforeLabel, cls: "ba-tag" },
    { image: props.after, label: props.afterLabel, cls: "ba-tag ba-after" },
  ];
  return (
    <div className="ba">
      {photos.map(({ image, label, cls }) => (
        <a key={cls} className="ba-fig" href={withBasePath(image.src)} data-lb={props.group} data-cap={label || image.alt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...imageProps(image, "(min-width: 960px) 50vw, 100vw")} alt={image.alt} style={focusStyle(image)} loading="lazy" />
          {label && <span className={cls}>{label}</span>}
        </a>
      ))}
    </div>
  );
}
