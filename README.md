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

Grunddesignet bruger sort krom, dybrødt neon, blanke overflader og glød. Terninger, slotmaskine og spin-hjul har hver deres animation, efterfulgt af en kort partikeleffekt. Spiltilstand og pakkedesign giver yderligere visuel variation. Layoutet er responsivt til mobil, tablet og desktop.

## Udgiv fra docs

I GitHub: Settings → Pages → Deploy from a branch → `main` → `/docs` → Save.

Alle stier er relative, og der er ingen eksterne script- eller skrifttypeafhængigheder.

## Teknisk

HTML, CSS og almindelig JavaScript. Native dialoger, IndexedDB til billed-blobs og pakkesnapshots, Canvas/WebP-optimering, responsivt layout og støtte for reducerede animationer. `modes.js`/`modes.css` håndterer spiltilstande, mens `packs.js`/`packs.css` håndterer pakkebibliotek og designer. Tilfældige resultater bruger `crypto.getRandomValues` med rejection sampling.

Ved fremtidige ændringer: opdater cacheversionen i `docs/sw.js`, så offlinefiler fornyes.

## Spilleplader

Vælg mellem **Terninger**, **Lucky Slot** og **Spin-hjul**. Alle tre deler de samme redigerbare sider, billeder, spilpakker og resultater. Op til fire terninger/hjul kan bruges; kun ét animeres pr. handling. Hjulets markør og slotmaskinens midterlinje lander på det udtrukne felt. Identiske tekster forbliver separate felter med hver sin chance. Valg af spilleplade og effekter gemmes separat fra terningernes indhold.

Temaet bruger dybrødt neon, sort krom, glans og glød. Knappen **Effekter til/fra** dæmper bevægelserne, og systemets reduceret-bevægelse-indstilling respekteres. Der er ingen lydafspilning.

Spin-hjulet viser billedresultater i et stort panel. Billedsider uden tekst får separate feltnumre, så de kan skelnes fra hinanden.

## Sikker gemning og redigering

Editoren validerer hele sættet før gemning og bevarer kladden, hvis lageret ikke kan skrive. Sletning og annullering kan ikke ramme en anden redigeringssession; billedoprydning beskytter det gemte sæt, sikkerhedskopien og aktive uploads. Skift til en færdig spiltilstand afbrydes, hvis den nødvendige sikkerhedskopi ikke kan gemmes.

Spilpakke-designeren gemmer et fast snapshot, venter på coverbehandling og låser handlingerne under gemning. En tidligere cover-upload kan ikke ændre en senere designersession. Covervælgeren kan betjenes med tastatur, og fejl ved pakkeåbning vises uden at låse knappen.

## Regressionstests

Kør fra repository-roden med Node.js. Testene kræver ingen ekstra pakker:

```sh
node tests/state-regression.cjs
node tests/pack-regression.cjs
node tests/board-regression.cjs
```

De 38 kontroller kører de faktiske produktionsfunktioner med kontrollerede DOM- og lagergrænser. De dækker samtidig redigering, gemmefejl, fyldt lager, transaktionsfejl, backup/gendannelse, spilpakker, coverbehandling og billedresultater. Visuel browserkontrol supplerer disse tests.
