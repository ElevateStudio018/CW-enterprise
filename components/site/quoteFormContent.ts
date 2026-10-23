import { list } from "@/lib/site/collection.ts";
import type { SiteData } from "@/lib/site/schema.ts";
import type { QuoteFormContent } from "../QuoteForm";

/** Just the parts of the content the quote form needs, as it is handed to the browser. */
export function quoteFormContent(site: SiteData): QuoteFormContent {
  return {
    texts: site.form,
    workTypes: list(site.form.workTypes).map(({ id, label }) => ({ id, label })),
    phone: site.company.phone,
  };
}
