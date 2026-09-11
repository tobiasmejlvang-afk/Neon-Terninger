# Neon Terninger – After Dark

Dansk terningapp til mobil og tablet med et mørkt, sensuelt neon-tema. Kører direkte fra `docs/` på GitHub Pages uden pakker eller byggetrin.

## Spiltilstande

Appen har fire færdige intensitetsniveauer: **Romantisk**, **Flirtende**, **Vovet** og **After Dark**. Hver tilstand indlæser fire specialterninger, som bagefter kan redigeres med egne tekster og billeder. Brugerens personlige sæt kan gendannes efter brug af presets.

## Spilpakker og designer

**Spilpakker** er et lokalt bibliotek til komplette personlige sæt som fx **Date Night**, **Weekend**, **Hotel** eller **Vores favoritter**.

Den indbyggede **Spilpakke-designer** kan:

- Oprette en pakke fra det aktuelle sæt eller som en helt ny tom pakke.
- Give pakken navn og en kort beskrivelse.
- Vælge mellem 8 ikoner og 8 farvetemaer.
- Tilføje et coverbillede, som automatisk skaleres og WebP-optimeres.
- Vælge 1–4 aktive terninger.
- Ændre terningernes rækkefølge uden at slette de inaktive terninger.
- Redigere designet på allerede gemte pakker uden at miste terningernes indhold.

Pakken gemmer antal aktive terninger, navne, sider, tekster og billeder. Billeder kopieres til pakkens eget IndexedDB-snapshot. Når pakken åbnes, gendannes billederne med nye interne ID'er. En gemt pakke kan åbnes, opdateres med det aktive sæt, designes, omdøbes eller slettes. Cover, ikon, farve og beskrivelse bevares, når indholdet opdateres.

## Brug

- Vælg 1–4 aktive terninger og slå med én ad gangen.
- Rediger navn og 2–20 sider på hver terning.
- Hver side kan indeholde **tekst, billede eller begge dele**.
- Uploadede billeder skaleres automatisk ned og WebP-komprimeres.
- Tekst og terningekonfiguration gemmes i `localStorage`. Billeder og spilpakker gemmes i browserens `IndexedDB`.
- Ingen konto, analyseværktøjer, cloud-upload eller synkronisering. Personlige billeder forlader ikke enheden i denne implementation.
- Appen kan installeres på hjemmeskærmen og bruges offline efter første fulde indlæsning.

## Visuelt tema

Grunddesignet bruger sort/plum baggrund, vinrød, pink og violet neon, bløde glows og et voksent, elegant udtryk. Spiltilstand og pakkedesign giver yderligere visuel variation. Layoutet er responsivt til mobil, tablet og desktop.

## Udgiv fra docs

I GitHub: Settings → Pages → Deploy from a branch → `main` → `/docs` → Save.

Alle stier er relative, og der er ingen eksterne script- eller skrifttypeafhængigheder.

## Teknisk

HTML, CSS og almindelig JavaScript. Native dialoger, IndexedDB til billed-blobs og pakkesnapshots, Canvas/WebP-optimering, responsivt layout og støtte for reducerede animationer. `modes.js`/`modes.css` håndterer spiltilstande, mens `packs.js`/`packs.css` håndterer pakkebibliotek og designer. Tilfældige resultater bruger `crypto.getRandomValues` med rejection sampling.

Ved fremtidige ændringer: opdater cacheversionen i `docs/sw.js`, så offlinefiler fornyes.
