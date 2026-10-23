import { Breadcrumbs } from "../Breadcrumbs";
import { FaktaBox } from "../FaktaBox";
import { list } from "@/lib/site/collection.ts";
import type { SectionProps } from "./types";

/** The opening of the about page: heading, introduction and the company's facts beside it. */
export function AboutIntroSection({ section, ctx }: SectionProps<"aboutIntro">) {
  const { breadcrumbs } = ctx;
  const Heading = breadcrumbs ? "h1" : "h2";
  const facts = list(section.facts);

  return (
    <div id={section.anchor || undefined} className="mx-auto max-w-content px-4 pt-8 sm:px-6 lg:px-8 lg:pt-10">
      {breadcrumbs && (
        // The text rises into place one part after another as the page loads, as on the homepage.
        <div className="animate-rise [animation-delay:150ms]">
          <Breadcrumbs items={breadcrumbs} label={ctx.site.ui.breadcrumbsLabel} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-12 lg:mt-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <article>
          <Heading className="animate-rise text-display text-heading [animation-delay:250ms] lg:text-[56px] lg:leading-[1.08]">{section.heading}</Heading>
          {section.subheading && (
            <p className="mt-3 animate-rise text-copy font-semibold text-heading [animation-delay:350ms] lg:mt-6 lg:text-[21px]">
              {section.subheading}
            </p>
          )}
          <div className="mt-4 animate-rise space-y-4 [animation-delay:450ms]">
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className="text-copy text-body lg:text-[18px]">
                {paragraph}
              </p>
            ))}
          </div>
        </article>

        {facts.length > 0 && (
          <aside className="animate-rise [animation-delay:550ms] lg:pt-3">
            <FaktaBox title={section.factsTitle} rows={facts} />
          </aside>
        )}
      </div>
    </div>
  );
}
