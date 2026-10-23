import type { MetadataRoute } from "next";
import { getSite } from "@/lib/site/data.ts";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSite().settings.siteUrl;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/forslag/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
