import { Fragment } from "react";
import { list } from "@/lib/site/collection.ts";
import type { Page, Section, SiteData } from "@/lib/site/schema.ts";
import type { Crumb } from "../Breadcrumbs";
import { attachesTop, flushBottom, opensPage, sectionComponents } from "../sections/registry";
import type { SectionProps } from "../sections/types";

/** Bottom space for a flush section that nothing carries on from. */
const closingSpace = "pb-16 sm:pb-20 lg:pb-28";

/** Renders a page's visible sections in order. */
export function PageView({
  page,
  site,
  isHome,
  previewIds = false,
  reveal,
}: {
  page: Page;
  site: SiteData;
  isHome: boolean;
  previewIds?: boolean;
  /** In the admin preview: a hidden section being edited, shown faded with this label. */
  reveal?: { id: string; label: string };
}) {
  const sections = list(page.sections).filter((section) => !section.hidden || section.id === reveal?.id);
  const breadcrumbs: Crumb[] = [{ label: site.ui.breadcrumbHome, href: "/" }, { label: page.title }];
  // On a subpage the first section that opens it shows the breadcrumb trail and the page's main heading.
  const opener = isHome ? -1 : sections.findIndex((section) => opensPage.has(section.type));

  return (
    <>
      {sections.map((section, index) => {
        const Component = sectionComponents[section.type] as React.ComponentType<SectionProps<Section["type"]>>;
        const previous = sections[index - 1];
        const next = sections[index + 1];
        const attached = Boolean(previous && flushBottom.has(previous.type) && attachesTop.has(section.type));
        const needsClosingSpace = flushBottom.has(section.type) && !(next && attachesTop.has(next.type));
        return (
          <Fragment key={section.id}>
            {/* In the admin preview each section carries a marker, so the editor can bring it into view. */}
            {previewIds && <span data-preview-section={section.id} className="block scroll-mt-20" aria-hidden="true" />}
            {section.hidden ? (
              <div className="relative opacity-50">
                <span className="absolute left-4 top-4 z-10 rounded-full bg-black/80 px-3 py-1.5 text-[13px] font-semibold text-white">{reveal?.label}</span>
                <Component section={section} id={section.id} ctx={{ site, attached, breadcrumbs: index === opener ? breadcrumbs : undefined }} />
              </div>
            ) : (
              <Component section={section} id={section.id} ctx={{ site, attached, breadcrumbs: index === opener ? breadcrumbs : undefined }} />
            )}
            {needsClosingSpace && <div aria-hidden="true" className={closingSpace} />}
          </Fragment>
        );
      })}
    </>
  );
}
