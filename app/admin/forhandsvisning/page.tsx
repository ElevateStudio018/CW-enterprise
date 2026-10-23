"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { QuoteModal } from "@/components/QuoteModal";
import { PageView } from "@/components/site/PageView";
import { ServicePageView } from "@/components/site/ServicePageView";
import { NotFoundView } from "@/components/site/NotFoundView";
import { MaintenanceView } from "@/components/site/MaintenanceView";
import { navContent } from "@/components/site/navContent";
import { quoteFormContent } from "@/components/site/quoteFormContent";
import { QuoteForm } from "@/components/QuoteForm";
import { QuoteModalProvider } from "@/contexts/QuoteModalContext";
import { themeCss } from "@/lib/site/theme.ts";
import { homePage } from "@/lib/site/pages.ts";
import { googleFontsHref } from "@/lib/site/fonts.ts";
import type { SiteData } from "@/lib/site/schema.ts";
import { PREVIEW_READY, type PreviewMessage, type PreviewTarget } from "@/lib/admin/preview";

/** Google Fonts for the draft's fonts, here in the preview only (the published site hosts its own copies). */
function fontHref(site: SiteData): string | null {
  const families = Array.from(new Set(Object.values(site.theme.fonts).map((font) => font.family))).filter((family) => family !== "Figtree");
  return families.length > 0 ? googleFontsHref(families) : null;
}

/** The editor's live preview: the public site's own components, drawn from the draft the editor sends. */
export default function PreviewPage() {
  const [site, setSite] = useState<SiteData | null>(null);
  const [target, setTarget] = useState<PreviewTarget | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as PreviewMessage;
      if (data?.type !== "cwe-preview") return;
      setSite(data.draft);
      setTarget(data.target);
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: PREVIEW_READY }, window.location.origin);
    // Links in the preview go nowhere: it shows the page, it does not browse.
    const stopLinks = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a");
      if (link) event.preventDefault();
    };
    document.addEventListener("click", stopLinks, true);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", stopLinks, true);
    };
  }, []);

  // Bring the part being edited into view: a section, or the footer.
  const focusKey = target?.kind === "page" ? target.sectionId ?? "" : target?.kind === "chrome" ? target.part : "";
  useEffect(() => {
    if (!focusKey) return;
    const selector = focusKey === "footer" ? "footer" : focusKey === "navigation" ? "body" : `[data-preview-section="${focusKey}"]`;
    const element = document.querySelector(selector);
    if (focusKey === "navigation") window.scrollTo({ top: 0, behavior: "smooth" });
    else element?.scrollIntoView({ block: "start", behavior: "smooth" });
    // Only when the part changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, Boolean(site)]);

  const fonts = useMemo(() => (site ? fontHref(site) : null), [site]);

  if (!site || !target) return <div className="min-h-svh bg-[#F4F3EF]" />;

  const theme = <style dangerouslySetInnerHTML={{ __html: `${themeCss(site.theme)}body{background:rgb(var(--c-background));color:rgb(var(--c-text))}` }} />;
  const fontLink = fonts && <link rel="stylesheet" href={fonts} />;

  if (target.kind === "maintenance") {
    return (
      <>
        {theme}
        {fontLink}
        <MaintenanceView site={site} />
      </>
    );
  }

  let body: React.ReactNode;
  if (target.kind === "chrome" && target.part === "form") {
    body = (
      <div className="mx-auto max-w-md px-4 py-10">
        <h2 className="mb-6 text-h2 text-heading">{site.form.modalHeading}</h2>
        <div className="bg-card p-6">
          <QuoteForm variant="inline" content={quoteFormContent(site)} />
        </div>
      </div>
    );
  } else if (target.kind === "service") {
    const service = site.services.items[target.serviceId];
    body = service ? <ServicePageView site={site} service={service} /> : null;
  } else if (target.kind === "notFound") {
    body = <NotFoundView site={site} />;
  } else {
    const page = target.kind === "page" ? site.pages.items[target.pageId] : homePage(site);
    const reveal = target.kind === "page" && target.sectionId ? { id: target.sectionId, label: "Dold – syns inte på hemsidan" } : undefined;
    body = page ? <PageView page={page} site={site} isHome={page.slug === ""} previewIds reveal={reveal} /> : null;
  }

  return (
    <QuoteModalProvider>
      {theme}
      {fontLink}
      <div className="vk">
        <Navbar content={navContent(site)} />
        <main>{body}</main>
        <Footer site={site} />
        <QuoteModal content={quoteFormContent(site)} closeLabel={site.ui.closeLabel} />
      </div>
    </QuoteModalProvider>
  );
}
