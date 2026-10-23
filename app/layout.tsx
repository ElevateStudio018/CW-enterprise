import type { Metadata } from "next";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "@fontsource/figtree/800.css";
import "./globals.css";
import "./site.css";
import { getSite } from "@/lib/site/data.ts";
import { homePage } from "@/lib/site/pages.ts";
import { withBasePath } from "@/lib/site/images.ts";

export function generateMetadata(): Metadata {
  const site = getSite();
  const { seo } = homePage(site);
  return {
    metadataBase: new URL(site.settings.siteUrl),
    title: { default: seo.title, template: `%s | ${site.settings.siteName}` },
    description: seo.description,
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: site.settings.siteUrl,
      siteName: site.settings.siteName,
      locale: "sv_SE",
      type: "website",
    },
    alternates: { canonical: "/" },
    icons: { icon: withBasePath(site.settings.favicon.src) },
    // The maintenance notice is not something search engines should keep.
    ...(site.settings.maintenance.enabled ? { robots: { index: false, follow: false } } : {}),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getSite().settings.language} suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
