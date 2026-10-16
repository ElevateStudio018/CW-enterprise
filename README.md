# CW Enterprise AB – webbplats

Statisk webbplats för CW Enterprise AB (Management Consulting, CWE Fastighetsförvaltning och byggtjänster via Västkust Bygg & Montage AB). Bygger vidare på den tidigare sidans innehåll, bild och typsnitt (Josefin Sans), med 3D-modeller i Three.js.

## Bygga och köra lokalt

```bash
npm run build   # skapar dist/
npm run serve   # bygger och startar http://localhost:8080
```

`dist/` är det som laddas upp till webbhotellet.

Förhandsvisning: https://elevatestudio018.github.io/CW-enterprise/ (GitHub Pages, publiceras från branchen `gh-pages`, som innehåller en byggd kopia av `dist/`).

## Struktur

- `src/pages/` – en fil per sida. `{{> header}}`, `{{> head}}`, `{{> footer}}` ersätts vid bygget.
- `src/partials/` – gemensam head, header (meny) och footer.
- `assets/css/style.css` – all styling (färger och typsnitt överst i `:root`).
- `assets/js/main.js` – meny och kontaktformulär.
- `assets/js/scenes.js` – 3D-modellerna. Ett element med `data-model="koncern|system|building|frame"` får en modell.

3D laddas bara om webbläsaren har WebGL. Med "reducerad rörelse" påslaget visas en stillbild.
Kontaktformuläret har ingen server, utan öppnar besökarens e-postprogram.
