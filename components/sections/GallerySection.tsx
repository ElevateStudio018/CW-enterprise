import { MoreLink, SecHead, paragraphs } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps, withBasePath } from "@/lib/site/images.ts";
import type { SiteImage } from "@/lib/site/schema.ts";
import type { SectionProps } from "./types";

/** Photos in a grid with their captions; each opens large. A heading and text above, with a link on the right. */
export function GallerySection({ section, id }: SectionProps<"gallery">) {
  const images = list(section.images);
  const text = paragraphs(section.text);
  return (
    <section id={section.anchor || undefined} className="sec gallery-sec">
      <div className="wrap">
        {text.length > 0 ? (
          <div className="part-head">
            <SecHead eyebrow={section.eyebrow} heading={section.heading} />
            <div>
              {text.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <MoreLink link={section.link} />
            </div>
          </div>
        ) : (
          <SecHead eyebrow={section.eyebrow} heading={section.heading} right={<MoreLink link={section.link} />} />
        )}
        <Gallery group={`g-${id}`} images={images} />
      </div>
    </section>
  );
}

export function Gallery({ group, images }: { group: string; images: { id: string; image: SiteImage; caption: string }[] }) {
  const cols = images.length > 0 && images.length <= 3 ? " c3" : "";
  return (
    <ul className={`gallery${cols}`}>
      {images.map(({ id, image, caption }) => (
        <li key={id}>
          <a href={withBasePath(image.src)} data-lb={group} data-cap={caption || image.alt}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...imageProps(image, "(min-width: 960px) 25vw, 50vw")} alt={image.alt} style={focusStyle(image)} loading="lazy" />
            {caption && <span className="g-cap">{caption}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
