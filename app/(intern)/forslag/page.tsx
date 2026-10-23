import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { SuggestionForm } from "@/components/SuggestionForm";
import { fontFaceCss, getSite } from "@/lib/site/data.ts";
import { list } from "@/lib/site/collection.ts";
import { themeCss } from "@/lib/site/theme.ts";

// The staff's suggestion box: a page of its own that is not in the menu, the sitemap or search engines. Its words are
// the tool's own (like the admin's), not part of the site's content.
export const metadata: Metadata = {
  title: "Förslag på förbättringar",
  robots: { index: false, follow: false },
};

export default function SuggestionsPage() {
  const site = getSite();
  const pages = list(site.pages).map((page) => (page.slug ? page.title : "Startsidan"));
  const areas = ["Hela hemsidan", ...pages, "En tjänstesida", "Offertformuläret", "Kontaktuppgifterna", "Annat"];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: fontFaceCss() + themeCss(site.theme) }} />
      <div className="min-h-svh bg-page">
        <header className="bg-nav text-nav-text">
          <div className="mx-auto max-w-content px-4 py-4 sm:px-6 lg:px-8">
            <Wordmark content={{ logo: site.settings.logo, name: site.company.shortName }} />
          </div>
        </header>
        <main id="innehall" className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <p className="text-tag uppercase text-muted">För medarbetare på {site.company.shortName}</p>
          <h1 className="mt-4 text-display text-heading lg:text-[46px] lg:leading-[1.1]">Förslag på förbättringar av hemsidan</h1>
          <p className="mt-5 text-[18px] leading-relaxed text-body">
            Ser du något på hemsidan som kan bli bättre? En text som inte stämmer, en bild som saknas, något kunderna ofta frågar om. Skriv ditt namn och
            ditt förslag, så går det direkt till den som sköter hemsidan.
          </p>
          <div className="mt-9 bg-card p-6 sm:p-8">
            <SuggestionForm areas={areas} />
          </div>
        </main>
      </div>
    </>
  );
}
