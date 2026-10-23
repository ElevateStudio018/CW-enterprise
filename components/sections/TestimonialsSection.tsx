import { Eyebrow, Stars } from "../vk/parts";
import { ReviewSlider } from "../vk/ReviewSlider";
import { list } from "@/lib/site/collection.ts";
import type { SiteData } from "@/lib/site/schema.ts";
import type { SectionProps } from "./types";

interface Review {
  id: string;
  title: string;
  quote: string;
  name: string;
  detail: string;
  rating: number;
}

export function ReviewCard({ review, ratingLabel }: { review: Review; ratingLabel: string }) {
  return (
    <figure className="rev">
      <Stars n={review.rating} label={ratingLabel} />
      {review.title && <p className="rev-job">{review.title}</p>}
      <blockquote>
        <p>”{review.quote}”</p>
      </blockquote>
      <figcaption>
        <span className="av" aria-hidden="true">
          {review.name.slice(0, 1)}
        </span>
        <span>
          <b>{review.name}</b>
          {review.detail && <small>{review.detail}</small>}
        </span>
      </figcaption>
    </figure>
  );
}

/** All reviews in a row to page through, with the overall rating beside the heading. */
export function Reviews({ eyebrow, heading, text, reviews, site, tint = true }: { eyebrow: string; heading: string; text: string; reviews: Review[]; site: SiteData; tint?: boolean }) {
  const rated = reviews.filter((r) => r.rating > 0);
  const average = rated.length ? rated.reduce((sum, r) => sum + r.rating, 0) / rated.length : 0;
  const head = (
    <div>
      <Eyebrow text={eyebrow} />
      {heading && <h2>{heading}</h2>}
    </div>
  );
  const rating =
    average > 0 ? (
      <p className="rating">
        <Stars n={Math.round(average)} label={site.ui.ratingLabel} />
        <span>
          <b>{`${average.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} av 5`}</b>
          {text ? ` ${text}` : ""}
        </span>
      </p>
    ) : undefined;
  return (
    <section className={`sec${tint ? " tint" : ""}`}>
      <div className="wrap">
        <ReviewSlider head={head} aside={rating} labels={{ previous: site.ui.carouselPrevious, next: site.ui.carouselNext }}>
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} ratingLabel={site.ui.ratingLabel} />
            </li>
          ))}
        </ReviewSlider>
      </div>
    </section>
  );
}

export function TestimonialsSection({ section, ctx }: SectionProps<"testimonials">) {
  return (
    <div id={section.anchor || undefined}>
      <Reviews eyebrow={section.eyebrow} heading={section.heading} text={section.text} reviews={list(section.items)} site={ctx.site} />
    </div>
  );
}
