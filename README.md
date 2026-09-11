# Neon Terninger – After Dark

Dansk terningapp til mobil og tablet med et mørkt, sensuelt neon-tema. Kører direkte fra `docs/` på GitHub Pages uden pakker eller byggetrin.

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

After Dark-designet bruger sort/plum baggrund, vinrød, pink og violet neon, bløde glows og et mere voksent, elegant udtryk. Temaet er sensuelt frem for eksplicit og er responsivt til mobil, tablet og desktop.

## Udgiv fra docs

I GitHub: Settings → Pages → Deploy from a branch → `main` → `/docs` → Save.

Alle stier er relative, så appen fungerer på en GitHub Pages-projektadresse. Der er ingen eksterne script- eller skrifttypeafhængigheder.

## Teknisk

HTML, CSS og almindelig JavaScript. Native dialoger, IndexedDB til billed-blobs, Canvas/WebP-optimering, store trykflader, responsivt layout og støtte for reducerede animationer. Tilfældige resultater bruger `crypto.getRandomValues` med rejection sampling. Kun ét slag kan køre ad gangen.

Ved fremtidige ændringer: opdater cacheversionen i `docs/sw.js`, så offlinefiler fornyes.
