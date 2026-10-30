# CW Enterprise AB – hemsida med adminpanel

Hemsida för CW Enterprise AB (Management Consulting, CWE Fastighetsförvaltning och byggtjänster via helägda Västkust
Bygg & Montage AB), med samma adminpanel som Västkust Bygg & Montages nya hemsida: ägaren ändrar texter, bilder,
färger och sidor själv, får förfrågningarna i panelen och kan be AI-assistenten om ändringar.

- Hemsidan: https://elevatestudio018.github.io/CW-enterprise/ (blir https://cwenterprise.se/ vid lanseringen, se [LANSERING.md](LANSERING.md))
- Adminpanelen: https://elevatestudio018.github.io/CW-enterprise/admin/
- Supabase-projekt: `cw-enterprise` (ref `chnvmoxbsrefeahqgfht`, Stockholm)

Kvar att göra för att komma igång: se [SETUP.md](SETUP.md).

## Så hänger det ihop

- **Next.js** med statisk export (basePath `/CW-enterprise` på förhandsvisningen, `/` på cwenterprise.se; styrs av repovariabeln `SITE_DOMAIN`). Allt innehåll är ett dokument (`lib/site/schema.ts`);
  varje sida är en lista sektioner som ritas av `components/sections/`.
- **Utseendet** kommer från temat i adminpanelen: Josefin Sans (rubriker, som på den tidigare hemsidan), Nunito Sans,
  och färgerna från loggorna. `app/site.css` har stilarna.
- **Egna sektionstyper för CW:** *Tidslinje* (uppdrag på en tidsskala) och *3D-modell* (Three.js:
  `components/sections/model/`). Båda går att lägga till och ändra i adminpanelen.
- **Supabase** (`supabase/`): databas, Edge Functions för publicering, förfrågningar, förslag, inbjudningar och AI.
- **Publicering:** `.github/workflows/deploy-pages.yml` bygger från det publicerade innehållet i Supabase och lägger
  sajten på grenen `gh-pages`. Knappen Publicera i adminpanelen startar samma workflow.

## Utveckla

```bash
npm ci
npm run dev                       # http://localhost:3000
GITHUB_PAGES=true npm run build   # som på GitHub Pages, till out/
python3 tools/make_baseline.py    # ursprungsinnehållet, content/baseline.json
node scripts/sync-shared.mjs      # efter ändringar i lib/site eller content/baseline.json
node scripts/bundle-functions.mjs # paketerar Edge Functions till supabase/bundles/
node scripts/check-build.mjs out  # kontrollerar länkar, bilder och adresser i ett färdigt bygge
npx tsx supabase/tests/changeset.test.ts
```

## Innehållet – gå igenom

Från den tidigare cwenterprise.se: rubriken, tjänsternas korttexter, uppdragen, kontaktuppgifterna, fjällbilden och
CWE-loggan. Från vastkustbygg.se: byggtjänsterna, certifikaten och projektbilderna. Förslag att bekräfta (märkta
FÖRSLAG i `tools/make_baseline.py`): de längre texterna om Management Consulting och vad förvaltningen omfattar.
Org.nr saknas och visas inte.
