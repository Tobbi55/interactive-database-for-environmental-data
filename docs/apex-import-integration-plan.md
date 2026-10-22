# Plan: APEX CSV-støtte på «Legg inn data»

## Mål og avgrensning

Legg til en lokal importhjelper på «Legg inn data» som leser APEX-logger og fyller ut stasjonsfeltene før brukeren sender inn skjemaet.

- CSV-filer skal behandles lokalt i nettleseren.
- Ingen backend-kall skal gjøres ved filvalg, parsing, forhåndsvisning eller redigering.
- Innsending til backend er utenfor denne planen.
- Når brukeren velger å importere, overskrives de APEX-mappede stasjonsfeltene med verdiene fra den nye importen.
- Felter som ikke har APEX-mapping, samt manuelle fiskeobservasjoner, skal ikke overskrives av importen.
- Fiskedata fylles fortsatt inn manuelt.
- Hele GPS-sporet skal foreløpig brukes til å utlede start/stopp og lengde, ikke lagres som GPX eller sendes til backend.

## Avklarte regler

- `*_trends.csv` er obligatorisk. `*_faults.csv` og `*_events.csv` er valgfrie og brukes bare til kontroll/advarsler.
- Filer i samme import skal høre til samme APEX-enhet.
- En ny stasjon starter når `Timer (s)` er `0`, går til `1` etter en annen verdi, eller går tydelig bakover. Hver import nummereres fortløpende fra 1.
- Dato og klokkeslett start hentes fra første tidsstempel i stasjonssekvensen.
- Startkoordinat hentes fra raden der `Timer (s) = 5`.
- Stoppkoordinat hentes fra GPS-raden med høyeste timerverdi i sekvensen.
- `Sekunder fisket` blir høyeste `Timer (s)` i sekvensen.
- `Volt` hentes fra nominell spenning i `Waveform`, ikke målt `Peak Voltage`.
- `Puls (DC)` hentes fra frekvensen i Hz i `Waveform`.
- Ved flere verdier brukes vanligste verdi per stasjon, med advarsel ved variasjon. Ved likt antall eller ugyldig verdi må brukeren velge manuelt.
- For DC-rader uten frekvens gjettes ikke pulsverdien. Feltet blir stående tomt og må fylles ut før innsending.
- `Display` blir gjennomsnittet av `Average Current (A)` for den aktive stasjonssekvensen.
- `Transektlengde` blir summen av GPS-avstandene mellom påfølgende gyldige punkter. Estimatet er redigerbart og merkes som et estimat.
- En ny import erstatter APEX-mappede verdier i de aktuelle stasjonene; manuelle felt og fiskeobservasjoner bevares.
- Dominerende elvetype, vær, vanntemperatur, lufttemperatur, ledningsevne og fiskedata fylles inn manuelt.
- Stasjonsbeskrivelse står tom.

## Stegvis arbeidsplan

### 1. Lage og teste en ren APEX-parser

- [x] Lag en funksjon som leser trends-CSV uten UI- eller backend-avhengigheter.
- [x] Normaliser kolonnenavn og tallverdier; håndter ugyldig CSV, manglende obligatoriske kolonner og ugyldige koordinater med tydelige feil.
- [x] Del trends-radene i stasjonssekvenser etter de avklarte timer-reglene.
- [x] Lag enhetstester for timer-reset til 0, reset til 1, tydelig timer-tilbakegang, manglende/ugyldige kolonner og rader, koordinater og waveform.
- [x] Bruk eksempeldataene som testgrunnlag; forvent 17 sekvensgrupper fra eksempeltrends-filen før eventuell manuell redigering.

**Verifisering før neste steg — bestått:** alle 14 enhetstester passerer; den opplastede trends-filen gir 7 704 parsede rader, 17 grupper og ingen advarsler.

### 2. Utlede stasjonsverdier fra hver sekvens

- [x] Bygg en egen transformasjon fra sekvens til stasjonsutkast.
- [x] Hent dato/klokkeslett fra første rad, startpunkt fra `Timer (s) = 5`, stoppunkt fra høyeste timerverdi og sekunder fisket fra høyeste timerverdi.
- [x] Hvis punktet ved timer 5 mangler, bruk første gyldige GPS-punkt ved eller etter timer 5 og vis en advarsel. Hvis dette heller ikke finnes, la koordinaten stå tom og krev manuell retting.
- [x] Summer avstanden mellom påfølgende gyldige GPS-punkter for transektlengde; ikke glatt eller forkast punkter basert på GPS-nøyaktighet i første versjon.
- [x] Parse nominell volt og Hz fra `Waveform`; beregn vanligste verdi separat for volt og puls.
- [x] La puls stå tom hvis sekvensen mangler en frekvens som kan tolkes; vis advarsel og krev manuell verdi.
- [x] Beregn Display som gjennomsnitt av `Average Current (A)` i sekvensen.
- [x] Test hver feltmapping med små, håndlagde CSV-fixtures, inkludert varierende waveform, like hyppige verdier, DC, manglende timer 5 og manglende GPS.

**Verifisering før neste steg — bestått:** 25 tester passerer. Eksempeldata gir 17 stasjonsutkast; waveform-variasjon gir fire Volt/Puls-advarsler, mens parseren ikke finner ugyldige inputrader.

### 3. Legge til lokal filvalg og validering

- [x] Legg til en egen knapp med teksten «Importer APEX-data» på «Legg inn data».
- [x] Legg til en separat «Hjelp»-knapp som åpner en forklarende popup uten å starte importen.
- [x] Lag popupen som en tilgjengelig dialog med korte steg, feltmappinger og et visuelt, representativt utsnitt av `_trends.csv`.
- [x] Marker i utsnittet hvilken rad som gir startpunktet (`Timer (s) = 5`), hvilken som gir stoppunktet og hvordan timer-reset skiller stasjoner.
- [x] La brukeren velge trends-, faults- og events-filer. Trends kreves; faults/events kan utelates.
- [x] Kontroller filtype, forventede kolonner og at opplastede APEX-filer har samme enhets-ID når den finnes i filnavnet.
- [x] Vis lesbare feil for feil filtype, ugyldig CSV, manglende trends-fil eller filer som ser ut til å høre til ulike enheter.
- [x] Bruk faults/events bare til format-/enhetskontroll og relevante advarsler; de skal ikke endre stasjonsverdiene.
- [x] Sikre med test at filvalg og parsing ikke utløser nettverkskall.

**Verifisering før neste steg — bestått:** 25 målrettede enhetstester passerer. Testene dekker parser og filsett, lokal filvalg uten nettverkskall, forståelig dialog/utdrag og lesbar feilvisning.

### 4. Fylle eksisterende stasjonsskjema lokalt

- [x] Gjør ett stasjonsutkast per identifisert sekvens, nummerert fra 1.
- [x] Ved import skal APEX-mappede verdier overskrive tidligere verdier i de berørte stasjonene.
- [x] Bevar manuelle felter, brukerredigeringer i felter uten APEX-mapping og alle fiskeobservasjoner.
- [x] Fyll bare feltene som har en definert APEX-mapping; la manuelle felt og stasjonsbeskrivelse stå tomme.
- [x] La alle genererte stasjonsfelt kunne redigeres, inkludert stasjonsnummer og beregnede verdier.
- [x] La fiske-/observasjonsrader være tomme og kunne fylles inn manuelt som før.
- [x] Vis tydelig hvilke verdier som er estimater eller krever manuell kontroll.
- [x] Hvis importen gir et annet antall stasjoner enn skjemaet allerede har, varsle før stasjoner med manuelle data eller fiskedata fjernes.

**Verifisering før neste steg — bestått:** skjemaet fylles med importerte stasjoner; en integrasjonstest kontrollerer overskriving av APEX-felter, bevaring av manuelle felt og fiskeobservasjoner, avbrytelse og bekreftelse før dataførte stasjoner fjernes.

### 5. Kontrollere full flyt i «Legg inn data»

- [x] Test import av eksempelsettet gjennom UI-et og kontroller antall stasjoner, nummerering, dato/klokkeslett, koordinater, sekunder og beregnede felt.
- [x] Kontroller at advarsler for blandede/manglende verdier vises og kan rettes i skjemaet.
- [x] Kontroller at brukeren kan legge til, fjerne og redigere stasjoner etter import uten at nummereringen låser seg.
- [x] Bekreft at ingen backend-kall gjøres før skjemaets innsending.
- [x] Kjør relevante enhets- og komponenttester for parseren og «Legg inn data»-siden.

**Verifisering før ferdigstilling — bestått:** eksempelsettet gir 7 704 trends-rader og 17 stasjoner i skjemaet. Testen kontrollerer dato, klokkeslett, koordinater, sekunder fisket, transektlengde og at ingen `fetch`-kall gjøres. 37 målrettede tester passerer, og frontend-byggingen lykkes.

**Merknad:** Den fullstendige enhetstestsuiten har fortsatt feil i fire urelaterte områder: `api/postgrest.test.js`, `utils/formatData.test.js`, `lib/user-input/DateInput.test.js` og `lib/user-input/SpeciesInput.test.js`.

### 6. Fjerne midlertidige APEX-filer før PR

- [x] Før opprydding, bekreft at integrasjon og alle relevante tester er ferdige.
- [x] Fjern den midlertidige APEX-opplastingen under `APEX/APEX/`, inkludert rå CSV-er, SQLite/fiskedata, genererte kart-/rapportfiler, kopiert referanseverktøy og medfølgende `.venv`.
- [x] Behold integrasjonskoden og dette plandokumentet; ikke slett andre brukerfiler.
- [x] Kontroller at ingen APEX-opplastinger eller genererte APEX-data er sporet, staged eller inkludert i PR.

**Verifisering før PR — bestått:** ingen filer ligger igjen under `APEX/`, og ingen APEX-filer var sporet av Git. Etter opprydding passerer de 37 målrettede testene, og frontend-byggingen lykkes.

## Bevisst utenfor første versjon

- Innsending eller lagring i backend.
- Import eller automatisk kobling av fiskedata.
- Lagring av hele GPS-sporet i databasen eller som GPX.
- Automatisk utfylling av vær, elvetype, temperaturer eller ledningsevne.
- Filtrering/glatting av GPS-sporet for å korrigere GPS-støy.

## Backend-overlevering til IT

Frontend-arbeidet sender ikke inn skjemaet. «Publiser data» skal forbli deaktivert til IT har implementert og verifisert en API-kontrakt for lagring. Produksjons-API-et ligger utenfor dette frontend-repositoriet.

- Avklar hvilket eksisterende eller nytt backend-endepunkt som skal motta skjemaet. Ikke anta at filendepunktet i [Upload.md](./Upload.md), som tar imot Excel-filer, også støtter JSON-data fra skjemaet.
- Avtal en versjonert forespørsels- og responskontrakt som dekker elveinformasjon, stasjonsrader og manuelt registrerte fiskeobservasjoner. Bruk [Station.js](../client/src/models/Station.js), [River.js](../client/src/models/River.js), [Postgres-schema.md](./Postgres-schema.md) og importmappingen som utgangspunkt for feltnavn og datatyper.
- Avklar autentisering, autorisasjon, CSRF/CORS-krav og hvilke brukere som kan publisere.
- Valider data på serveren, inkludert obligatoriske verdier, unike stasjonsnumre, koordinatgrenser, dato/klokkeslett og referanser mellom elv, stasjoner og observasjoner. Klientvalidering erstatter ikke servervalidering.
- Lagre elv, stasjoner og observasjoner atomisk: en ugyldig underpost skal ikke etterlate en delvis publisert elv. Definer også hvordan gjentatt innsending og dobbeltklikk håndteres.
- Returner en entydig suksessrespons med opprettede ID-er og strukturert feilinformasjon som frontend kan knytte til relevante felt. Avklar hvordan valideringsfeil, tilgangsfeil, konflikter og midlertidige serverfeil skilles.
- Send bare ferdig redigerte skjemaopplysninger. Rå APEX-CSV-er og hele GPS-sporet sendes ikke; transektlengden og koordinatene i skjemaet sendes som ordinære stasjonsverdier.
- Legg til kontrakt-/integrasjonstester mot backend. Aktiver ikke «Publiser data» før lagring, transaksjonsatferd, feilvisning og gjentatt innsending er verifisert ende til ende.

## Relevante eksisterende filer

- Skjema: [add-data/+page.svelte](../client/src/routes/add-data/+page.svelte).
- Stasjonsfelter: [Station.js](../client/src/models/Station.js), [headers.js](../client/src/constants/headers.js) og [Postgres-schema.md](./Postgres-schema.md).

## Implementert endringsoversikt for PR

### APEX-import og skjema

- APEX CSV-filer leses og valideres lokalt i nettleseren. Trends er obligatorisk; faults og events er valgfrie. Importen kontrollerer CSV-format, nødvendige kolonner og enhets-ID når den kan leses fra filnavnet.
- Trends-data deles inn i stasjonssekvenser. Stasjonsutkastene fyller dato, tid, start-/stoppkoordinater, sekunder fisket, volt, puls, display og estimert transektlengde.
- APEX-import overskriver bare APEX-mappede felter. Manuelle verdier og fiskeobservasjoner bevares for stasjoner som beholdes. Import som fjerner dataførte stasjoner krever bekreftelse.
- Det følger med hjelpepanel, illustrerende trends-tabell og synlige advarsler for verdier som må kontrolleres manuelt.
- «Legg inn data» er lagt til i navigasjonen. Opplastingssiden tilbyr nå også nedlasting av `importmal.xlsx`, og en norsk artsliste brukes ved valg av fiskearter.
- Inndataområdet har fire visningskontroller over elveinformasjonen. Elvefelt, hver stasjonsdetalj og hver fiskeobservasjonstabell kan skjules uavhengig; globale knapper viser/skjuler alle stasjonsdetaljer eller alle observasjonstabeller. Observasjonstabellene har egne titler som angir stasjonsnummeret.
- En lys grønn «Publiser data»-knapp er plassert nederst til høyre, men er deaktivert og viser at backend-integrasjon mangler. **PR-oppfølging:** koble knappen til validering og innsending av elve-, stasjons- og fiskeobservasjonsdata til serveren/databasen. Ikke aktiver den før API-kontrakten, feilhåndteringen og lagringsflyten er implementert og verifisert.

### Kartforhåndsvisning og redigering

- Kartforhåndsvisningen viser nummererte start- og stoppunkter og en stasjonstabell, uten fiskeobservasjoner.
- Popupen er større, tabellområdet utnytter tilgjengelig plass, bakgrunnssidens rulling låses mens den er åpen, og musehjulet over kartet zoomer kartet. Klikk på en tabellrad zoomer til stasjonen.
- Kart- og tabellpanelet starter med lik høyde. Et tilgjengelig, drajusterbart skille endrer fordelingen; tabellen har egen rulling når innholdet ikke får plass.
- Alle tabellfeltene kan redigeres. Dra-og-slipp flytter hele stasjonsraden; lagring knytter fortsatt data og fiskeobservasjoner til stabil stasjonsnøkkel og oppdaterer rekkefølgen i skjemaet.
- Tomme felt markeres når stasjonsnummer og båttype er satt. Koordinat- og stasjonsnummerverdier valideres før lagring. Endringer i popupen oppdaterer skjemaet lokalt; de sendes ikke til backend.
- Ved import beregnes den opprinnelige transektlengden ved å summere GPS-avstanden mellom påfølgende gyldige punkter. GPS-sporet beholdes ikke videre i klienttilstanden. Når brukeren endrer start- eller stoppkoordinat, beregnes lengden utelukkende som rettlinjet avstand mellom de to endepunktene; ingen mellomliggende GPS-punkter brukes. Manglende eller ugyldige endepunkter tømmer transektlengden.

### Dokumentasjon og validering

- Brukerveiledningen beskriver APEX-import, advarsler, felttolkning, Cataraft-standard, redigering og kartfunksjoner: [UserManual.md](./UserManual.md).
- Den siste målrettede verifiseringen av kartredigering og transektlengde bestod med 40 tester i fem testfiler. ESLint og `npm run build` bestod.
- Nettleserverifisering bekreftet at stasjonsrader kan flyttes uten å skille stasjonsdata fra observasjoner, og at transektlengden endres etter koordinatredigering. Kartzoom med rullehjul og låsing av bakgrunnsrulling ble også kontrollert.
- En full testkjøring er ikke dokumentert som bestått; tidligere full-suite-kjøring hadde de fire urelaterte feilområdene nevnt ovenfor.

### Viktige implementasjonsfiler

- APEX-parser og validering: [apexImport.js](../client/src/utils/apexImport.js) og [ApexImportPanel.svelte](../client/src/lib/ApexImportPanel.svelte).
- APEX-mapping og GPS-lengde: [apexStationDrafts.js](../client/src/utils/apexStationDrafts.js).
- Kartutkast, koordinatvalidering og snapshots: [stationMapPreview.js](../client/src/utils/stationMapPreview.js) og [StationMapPreview.svelte](../client/src/lib/StationMapPreview.svelte).
- Skjemaintegrasjon og lokal tilstand: [add-data/+page.svelte](../client/src/routes/add-data/+page.svelte).
- Popupstørrelse og rullelås: [Modal.svelte](../client/src/lib/Modal.svelte).
- Navigasjon, opplastingsmal og artsvalg: [Header.svelte](../client/src/lib/Header.svelte), [upload/+page.svelte](../client/src/routes/upload/+page.svelte), [importmal.xlsx](../client/static/importmal.xlsx) og [norwegianFreshwaterFish.js](../client/src/lib/norwegianFreshwaterFish.js).

Ingen PR er opprettet.
