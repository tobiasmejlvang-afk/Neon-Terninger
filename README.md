# Neon Terninger · Party & Erotik

Dansk tablet- og mobilapp med fem sider. Udgives direkte fra `docs/` på GitHub Pages uden et byggetrin eller eksterne afhængigheder.

## Vælg jeres spil

Vælg **Party** eller **Erotisk**, 1–12 spillere og navne. Spilpakker vises efter kategori med søgning i navn, kategori og genre samt filter for intensitet. Fire startpakker gør det muligt at begynde med det samme; de kan kopieres og tilpasses i Designer.

## Spillet

Spil med **Terning**, **Lucky Spin** eller **Roulette** som valgt i Designer. Op til seks terninger/hjul, ét ad gangen, med 2–50 felter. Spillevisningen har ingen redigeringspaneler. I liggende tabletformat står resultaterne til højre; på smalle skærme står de under spillepladen. Tryk på en resultatboks for at vælge en terning eller genåbne indholdet.

**Ny runde** gemmer et snapshot i **Tidligere runder** og sender turen videre til næste spiller. Tomme runder kan ikke sendes videre. Historikken beholder de sidste 20 runder inklusive billeder i den aktuelle session og nulstilles ved genindlæsning. **Fuldskærm** skjuler menuerne og giver spillepladen mere plads; browsere uden Fullscreen API får en fokusvisning. En ny spilpakke starter altid på runde 1.

Hvert hjul/terning kan vise indhold, numre eller et valgfrit symbol. Nummer- og symbolvisning skjuler teksten og billedet under rulningen. Når feltet lander, åbnes en animeret popup med det faktiske indhold. Tilfældige resultater bruger `crypto.getRandomValues` med rejection sampling; alle felter har samme chance.

## Designer

Gem navn, beskrivelse, spiltype, kategori, genre, intensitet, spilleplade, tema og cover. Rediger hver terning/hjul og indsæt egne tekster og billeder fra biblioteket eller via upload. Skift mellem seks terninger uden at miste indholdet på inaktive terninger.

Pakken indeholder et selvstændigt snapshot af billederne. Senere billedredigering ændrer derfor ikke eksisterende spil. Gemning låser brugerfladen og venter på IndexedDB-transaktionens commit. En ugemt kladde bevares ved almindelige sideskift; udskiftning med en anden pakke kræver et aktivt valg i appen.

## Biblioteket

Upload billeder, ikoner og logoer, og organisér dem i navngivne mapper og kategorier. Søg og filtrér medier; genbrug dem som felter og covers i Designer.

Billedredigering tilbyder originalformat, kvadrat, 16:9 og 3:4, zoom, vandret/lodret udsnit, rotation og lysstyrke. Redigering gemmer en **ny kopi**. Originalen bevares. Uploads optimeres til WebP med gennemsigtighed bevaret. Maks. 20 MB pr. kildefil.

## Indstillinger

- Fire neon-temaer og egne gemte farvekombinationer med navn, neonfarve, ekstra farve og baggrund. Temaerne kan vælges pr. spilpakke.
- Effekter: følg enheden, til eller fra; tre animationstempoer og partikler til/fra.
- Spilleplade: balanceret, stor eller kompakt.
- Terning: neon-glas, sort krom eller mat.
- Lucky Spin: kabinet, neon-arkade eller minimal.
- Roulette: klassisk neon, lysende ringe eller minimal.

Et manuelt effektvalg går forud for enhedens reduceret-bevægelse-indstilling. Appen afspiller ikke lyd.

## Data og opgradering

Alt gemmes lokalt i browseren. Ingen konto, analyseværktøjer, server-upload eller synkronisering. Rydning af webstedsdata sletter lokale spil og medier. Appen kan føjes til hjemmeskærmen og bruges offline efter første fulde indlæsning.

Eksisterende version 1/2-konfigurationer og gemte spilpakker kan læses. Den aktive gamle konfiguration og en eventuel tidligere sikkerhedskopi kopieres til pakker under **Erotisk → Mine spil**. Originale lagerdata bevares. Gamle pakker beholder deres cover og billedsnapshots. Bibliotekets medier gemmes separat fra spillemotorens midlertidige billedkopier, og import under indlæsning beskyttes mod billedoprydning.

Lagring: `localStorage` til aktivt spil, spillere og indstillinger; IndexedDB `neon-terninger-media-v1`, `neon-terninger-packs-v1` og `neon-studio-assets-v1` til billeder, spilpakker og bibliotek.

## Udgivelse og kode

GitHub → Settings → Pages → Deploy from a branch → `main` → `/docs`.

- `app.js`: spillemotor og den eksisterende konfigurations-/billedlagring.
- `boards.js`, `boards.css`: terninger, slot og roulette med animationer.
- `studio-model.js`: datamodel, validering og startpakker.
- `studio.js`, `studio.css`: de fem sider, spillerne, designer, bibliotek, billedredigering og temaer.
- `play.js`, `play.css`: tablet-layout, fuldskærm og rundehistorik.
- `sw.js`: offline-cache. Opdater cacheversionen ved udgivelser.
- `modes.js` og `packs.js`: tidligere moduler beholdt som kompatibilitetsreference; de indlæses ikke i den nye brugerflade.

## Test

Kør med Node.js fra repository-roden:

```sh
node tests/state-regression.cjs
node tests/pack-regression.cjs
node tests/board-regression.cjs
node tests/studio-regression.cjs
node tests/play-regression.cjs
```

64 kontroller dækker validering, migration, billedimport og oprydning, gemmefejl, transaktionsfejl, editorer, effektvalg, navigation, pakkeåbning, rundeskift, genåbning af resultater, fuldskærm samt roulette-markørens position for alle felter på hjul med 2–50 felter. Pakke-testene omfatter også den tidligere implementation for at bevare dens regressionshistorik.

Browserkontrol: gem/genåbn pakker med seks hjul og 50 felter, skjulte felter og animeret popup, billedresultater, upload, beskæring, genbrug i designer, temaer/udseende efter genindlæsning samt mobil-/tablet-layout. Der er ikke udført en fysisk enhedstest på iPad/Android eller en udtømmende test af alle browseres lagerkvoter og offlineadfærd.
