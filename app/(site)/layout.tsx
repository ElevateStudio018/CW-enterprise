import { SiteShell } from "@/components/site/SiteShell";
import { getSite } from "@/lib/site/data.ts";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell site={getSite()}>{children}</SiteShell>;
}
