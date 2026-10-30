# Lansering på cwenterprise.se

Hemsidan ligger kvar på GitHub Pages. Domänen pekas om från den gamla hemsidan hos one.com till GitHub Pages.
Mejlen (Microsoft 365) påverkas inte, så länge bara de poster som nämns här ändras.

## Läget i dag

- **Ny hemsida:** https://elevatestudio018.github.io/CW-enterprise/ (byggs av `.github/workflows/deploy-pages.yml`
  till grenen `gh-pages`).
- **Gamla hemsidan:** https://cwenterprise.se/ på one.com:s webbhotell, IP 77.111.240.187.
- **DNS för cwenterprise.se hanteras i Microsoft 365, inte hos one.com.** Namnservrarna är
  `ns1–ns4.bdm.microsoftonline.com`, så DNS-posterna ändras i Microsoft 365 admin center → Inställningar → Domäner →
  cwenterprise.se → DNS-poster. Domänen är sannolikt registrerad hos one.com, men one.com:s DNS-panel används inte.
  Namnservrarna ska inte ändras.
- **Mejl:** Microsoft 365 (MX `cwenterprise-se.mail.protection.outlook.com`, SPF, DMARC, autodiscover). Rör inte.

## Lanseringsknappen

Allt styrs av en variabel i GitHub-repot: **Settings → Secrets and variables → Actions → Variables → `SITE_DOMAIN`**.

| `SITE_DOMAIN` | Bygget | Adress |
| --- | --- | --- |
| saknas | base path `/CW-enterprise`, ingen CNAME-fil | https://elevatestudio018.github.io/CW-enterprise/ |
| `cwenterprise.se` | roten `/`, `out/CNAME` = cwenterprise.se, canonical/sitemap/Open Graph mot https://cwenterprise.se | https://cwenterprise.se/ |

Så länge variabeln saknas ändras ingenting för besökarna. Kodändringarna är redan gjorda och testade i båda lägena
(`scripts/check-build.mjs` kontrollerar varje bygge innan det publiceras).

## DNS-poster att ändra (Microsoft 365 admin center)

**Ta bort / ersätt (bara webbposter):**

| Typ | Namn | Nuvarande värde | Åtgärd |
| --- | --- | --- | --- |
| A | @ (cwenterprise.se) | 77.111.240.187 | Ta bort (one.com:s webbhotell) |
| CNAME | www | cwenterprise.se.www.service.one.com | Ta bort (one.com:s webbhotell) |

**Lägg till:**

| Typ | Namn | Värde | TTL |
| --- | --- | --- | --- |
| A | @ | 185.199.108.153 | 3600 |
| A | @ | 185.199.109.153 | 3600 |
| A | @ | 185.199.110.153 | 3600 |
| A | @ | 185.199.111.153 | 3600 |
| AAAA | @ | 2606:50c0:8000::153 | 3600 |
| AAAA | @ | 2606:50c0:8001::153 | 3600 |
| AAAA | @ | 2606:50c0:8002::153 | 3600 |
| AAAA | @ | 2606:50c0:8003::153 | 3600 |
| CNAME | www | elevatestudio018.github.io | 3600 |

AAAA-posterna är valfria (IPv6). Om panelen inte tillåter flera A-poster på @, lägg in så många som går; en räcker för
att det ska fungera.

**Rör inte:** MX, TXT (`v=spf1 …`, `MS=…`, `mscid=…`, `v=DMARC1 …`), CNAME `autodiscover`, `enterpriseregistration`,
`enterpriseenrollment`, eventuella `selector1._domainkey`/`selector2._domainkey` och NS.

## Genomförande, i ordning

Räkna med 30–60 minuter, varav besökarna märker av bytet under några minuter. Gör det en lugn tid på dygnet.

1. **GitHub:** Settings → Pages → Custom domain: skriv `cwenterprise.se`, Save. GitHub varnar att DNS inte stämmer än;
   det är väntat.
2. **GitHub:** Settings → Secrets and variables → Actions → Variables → New: `SITE_DOMAIN` = `cwenterprise.se`.
3. **GitHub:** Actions → *Deploy site to GitHub Pages* → Run workflow. Vänta tills det är grönt (ca 2–3 min). Nu ligger
   sajten byggd för roten med CNAME på `gh-pages`. Förhandsadressen under /CW-enterprise/ slutar fungera i och med
   detta; det är lanseringen.
4. **Microsoft 365:** ändra DNS-posterna enligt tabellen ovan. Under spridningen (vanligen 5–30 min, TTL 3600 på de
   gamla posterna kan ge upp till en timme) ser en del besökare den gamla sajten och andra den nya. Mejlen påverkas inte.
5. **GitHub:** Settings → Pages. När DNS-kontrollen blir grön utfärdar GitHub ett certifikat (några minuter upp till
   en timme). Bocka därefter i **Enforce HTTPS**. Tills certifikatet finns ger https://cwenterprise.se en
   certifikatvarning medan http fungerar; det är avbrottet.
6. **Supabase** (Claude gör detta på begäran, eller du i Supabase → Edge Functions → Secrets):
   `SITE_URL` = `https://cwenterprise.se`, `ADMIN_URL` = `https://cwenterprise.se/admin`, och i Authentication → URL
   Configuration: Site URL = `https://cwenterprise.se/admin/`. Redirect-adresserna och CORS för cwenterprise.se är
   redan tillagda.
7. **Adminpanelen:** Inställningar → Hemsidan → Hemsidans adress = `https://cwenterprise.se` och Publicera. (Bygget
   skriver redan rätt adress i sitemap och canonical, men innehållet ska också stämma.)

## Kontroll efter lansering

- `https://cwenterprise.se/`, `/tjanster/forvaltning/`, `/certifikat/`, `/kontakt/`, `/admin/` svarar med den nya
  sajten och hänglås i webbläsaren.
- `https://www.cwenterprise.se/` skickar vidare till `https://cwenterprise.se/`.
- `https://cwenterprise.se/robots.txt` och `/sitemap.xml` nämner cwenterprise.se.
- `https://elevatestudio018.github.io/CW-enterprise/` skickar vidare till cwenterprise.se (GitHub gör det själv).
- Skicka en förfrågan via formuläret: den syns i adminpanelen och mejlet kommer fram.
- Logga in på `/admin/`, ändra en text, Publicera, och se att sajten uppdateras.
- Mejl: skicka ett mejl till och från info@cwenterprise.se. `nslookup -type=MX cwenterprise.se` ska fortfarande ge
  `cwenterprise-se.mail.protection.outlook.com`.

## Rollback

Den gamla hemsidan finns kvar orörd på one.com tills någon tar bort den där. Återställning är bara DNS:

1. Microsoft 365: ta bort de nya A/AAAA-posterna på @ och lägg tillbaka `A @ 77.111.240.187`; ändra `CNAME www`
   tillbaka till `cwenterprise.se.www.service.one.com`.
2. GitHub: ta bort `SITE_DOMAIN`-variabeln och kör workflowet igen, så fungerar förhandsadressen
   https://elevatestudio018.github.io/CW-enterprise/ på nytt. Ta bort custom domain under Settings → Pages.
3. Supabase: sätt tillbaka `SITE_URL`/`ADMIN_URL` och Site URL till github.io-adressen om de ändrats.

Återställningen tar lika lång tid som DNS-spridningen, normalt 5–30 minuter.
