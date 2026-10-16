# CW Enterprise AB – webbplats

Statisk webbplats för koncernen CW Enterprise AB (konsult, förvaltning, bygg) med 3D-scener i Three.js.

## Bygga och köra lokalt

```bash
npm run build   # skapar dist/
npm run serve   # bygger och startar http://localhost:8080
```

`dist/` är det som laddas upp till webbhotellet.

## Struktur

- `src/pages/` – en fil per sida. `{{> header}}`, `{{> head}}`, `{{> footer}}` ersätts vid bygget.
- `src/partials/` – gemensam head, header (meny) och footer.
- `assets/css/style.css` – all styling (färger och typsnitt överst i `:root`).
- `assets/js/main.js` – meny, scroll-animationer och kontaktformulär.
- `assets/js/scenes.js` – 3D-scenerna. Ett element med `data-scene="koncern|network|building|frame|terrain"` får en scen.

3D laddas bara om webbläsaren har WebGL. Med "reducerad rörelse" påslaget visas en stillbild.
Kontaktformuläret har ingen server, utan öppnar besökarens e-postprogram.
