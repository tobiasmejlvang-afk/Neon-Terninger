# Neon Terninger

Dansk terningapp til tablet med mørkt tema og neonrøde detaljer. Kører direkte fra `docs/` på GitHub Pages uden installation af pakker eller et byggetrin.

## Brug

- Vælg 1–4 aktive terninger, og slå med én ad gangen. Den røde knap vælger næste ukastede terning. Tryk på en bestemt terning for at slå med den igen.
- Rediger navn og sider med tekst, tal eller emojis. Hver terning har 2–20 sider med op til 80 tegn på hver side. Gentagelser er tilladt og har hver deres plads i lodtrækningen.
- Dine terninger og det valgte antal gemmes i browserens localStorage på denne enhed. Resultater gælder den aktuelle session. Ingen konto, analyseværktøjer eller synkronisering.
- Tilføj appen til hjemmeskærmen fra Safari på iPad eller Chrome på Android. Efter første fulde indlæsning kan den bruges offline.

## Udgiv fra docs

I GitHub: Settings → Pages → Deploy from a branch → `main` → `/docs` → Save.

Alle stier er relative, så appen fungerer på en GitHub Pages-projektadresse. Der er ingen eksterne script- eller skrifttypeafhængigheder.

## Teknisk

HTML, CSS og almindelig JavaScript. Native dialoger, store trykflader, responsivt layout og støtte for reducerede animationer. Tilfældige resultater bruger `crypto.getRandomValues` med rejection sampling. Kun ét slag kan køre ad gangen.

Ved fremtidige ændringer: opdater cacheversionen i `docs/sw.js`, så offlinefiler fornyes. En ny service worker aktiveres, når eksisterende appfaner lukkes.
