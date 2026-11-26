import type { Metadata, Viewport } from "next";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { DEFAULT_PRIME, primeBootScript, primeContrast } from "@/lib/admin/prime";
import { hexToChannels } from "@/lib/site/theme.ts";

export const metadata: Metadata = {
  title: { default: "Adminpanel", template: "%s – Adminpanel" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#F6F5F2" };

const fonts = '"Figtree", ui-sans-serif, system-ui, sans-serif';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `:root{--font-body:${fonts};--font-heading:${fonts};--font-button:${fonts};--admin-primary:${hexToChannels(DEFAULT_PRIME)};--admin-primary-contrast:${hexToChannels(primeContrast(DEFAULT_PRIME))}}body{background:#F6F5F2;color:#1E1E1C}`,
        }}
      />
      <script dangerouslySetInnerHTML={{ __html: primeBootScript }} />
      <AdminProviders>{children}</AdminProviders>
    </>
  );
}
