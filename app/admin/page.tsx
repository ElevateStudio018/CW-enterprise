import type { Metadata } from "next";

export const metadata: Metadata = { title: "Redigera hemsidan", robots: { index: false, follow: false } };

// The site is edited in Pages CMS, which saves into content/site.json in the repository; the site then rebuilds by
// itself (.github/workflows/deploy-pages.yml). Invited editors log in there with their e-mail address.
const CMS_URL = "https://app.pagescms.org/";

export default function AdminPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif", background: "#F1F3F6", color: "#121418" }}>
      <div style={{ maxWidth: 460, background: "#fff", borderRadius: 12, padding: "32px 30px", borderTop: "4px solid #121418" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 24 }}>Redigera hemsidan</h1>
        <p style={{ margin: "0 0 22px", lineHeight: 1.6, color: "#3B4048" }}>
          Texter och bilder ändras i Pages CMS. Logga in med e-postadressen du blivit inbjuden med. När du sparar uppdateras hemsidan av sig själv inom
          ett par minuter.
        </p>
        <a href={CMS_URL} style={{ display: "inline-block", padding: "13px 26px", borderRadius: 999, background: "#121418", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
          Öppna redigeringen →
        </a>
      </div>
    </main>
  );
}
