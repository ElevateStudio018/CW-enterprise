import type { SectionOf, SectionType, SiteData } from "@/lib/site/schema.ts";
import type { Crumb } from "../Breadcrumbs";

export interface SectionContext {
  site: SiteData;
  /** Set on a subpage's first section after its photo: the trail that section shows above its heading. */
  breadcrumbs?: Crumb[];
  /**
   * For sections that can carry on straight from the one before (a call-to-action block, a pair of photos): whether
   * the section before them ends without its own bottom space, so they close it off instead of starting afresh.
   */
  attached?: boolean;
}

export interface SectionProps<T extends SectionType> {
  section: SectionOf<T>;
  /** The section's id in its page, unique there. */
  id: string;
  ctx: SectionContext;
}
