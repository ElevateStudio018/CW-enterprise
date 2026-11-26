import type { Metadata } from "next";

// /admin opens Pages CMS straight on this site's content; signed-out editors log in there with their e-mail address and
// come back to the same place. Saving commits content/site.json and the site rebuilds by itself.
const CMS_URL = "https://app.pagescms.org/ElevateStudio018/CW-enterprise/claude%2Fny-webbplats";

export const metadata: Metadata = {
  title: "Redigera hemsidan",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif", background: "#F1F3F6", color: "#121418" }}>
      <meta httpEquiv="refresh" content={`0;url=${CMS_URL}`} />
      <script dangerouslySetInnerHTML={{ __html: `location.replace(${JSON.stringify(CMS_URL)})` }} />
      <div style={{ maxWidth: 460, background: "#fff", borderRadius: 12, padding: "32px 30px", borderTop: "4px solid #121418" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 24 }}>Redigera hemsidan</h1>
        <p style={{ margin: "0 0 22px", lineHeight: 1.6, color: "#3B4048" }}>Du skickas vidare till redigeringen. Händer inget, tryck på knappen.</p>
        <a href={CMS_URL} style={{ display: "inline-block", padding: "13px 26px", borderRadius: 999, background: "#121418", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
          Öppna redigeringen →
        </a>
      </div>
    </main>
  );
}
