# Neon Terninger – After Dark

Dansk terningapp til mobil og tablet med et mørkt, sensuelt neon-tema. Kører direkte fra `docs/` på GitHub Pages uden pakker eller byggetrin.

## Spiltilstande

Appen har nu fire færdige intensitetsniveauer:

- **Romantisk** – nærhed, søde ord og rolig kemi.
- **Flirtende** – mere blik, kys, spænding og drilleri.
- **Vovet** – mere mod, berøring og fristelse.
- **After Dark** – den mest intense standardtilstand, stadig med fokus på frivillighed og egne grænser.

Hver tilstand indlæser fire færdige specialterninger. De fungerer bagefter som almindelige terninger og kan redigeres med egne tekster og billeder. Første gang et preset aktiveres, gemmes brugerens nuværende personlige terninger som backup, så de kan gendannes fra Spilvælgeren. Skift mellem presets overskriver ikke denne backup.

## Brug

- Vælg 1–4 aktive terninger og slå med én ad gangen. Den glødende knap vælger næste ukastede terning, eller vælg selv en bestemt terning.
- Rediger navn og 2–20 sider på hver terning.
- Hver side kan indeholde **tekst, billede eller begge dele**. Tal og emojis fungerer stadig som før.
- Uploadede billeder skaleres automatisk ned til maks. 1200 px på længste led og WebP-komprimeres for at holde appen hurtig.
- Tekst og terningekonfiguration gemmes i `localStorage`. Billeder gemmes separat i browserens `IndexedDB`, så store billeder ikke fylder konfigurationslageret.
- Eksisterende version 1-terninger med tekst migreres automatisk til den nye version 2-datamodel.
- Ingen konto, analyseværktøjer, cloud-upload eller synkronisering. Personlige billeder forlader ikke enheden i denne implementation.
- Tilføj appen til hjemmeskærmen fra Safari på iPad eller Chrome på Android. Efter første fulde indlæsning kan den bruges offline.

## Visuelt tema

Grunddesignet bruger sort/plum baggrund, vinrød, pink og violet neon, bløde glows og et voksent, elegant udtryk. Valgt spiltilstand påvirker også accentfarver og terningens glow, så intensiteten kan aflæses visuelt. Layoutet er responsivt til mobil, tablet og desktop.

## Udgiv fra docs

I GitHub: Settings → Pages → Deploy from a branch → `main` → `/docs` → Save.

Alle stier er relative, så appen fungerer på en GitHub Pages-projektadresse. Der er ingen eksterne script- eller skrifttypeafhængigheder.

## Teknisk

HTML, CSS og almindelig JavaScript. Native dialoger, IndexedDB til billed-blobs, Canvas/WebP-optimering, store trykflader, responsivt layout og støtte for reducerede animationer. `modes.js` og `modes.css` holder spiltilstandene adskilt fra den eksisterende terningemotor. Tilfældige resultater bruger `crypto.getRandomValues` med rejection sampling. Kun ét slag kan køre ad gangen.

Ved fremtidige ændringer: opdater cacheversionen i `docs/sw.js`, så offlinefiler fornyes.
