<script>
  import { createEventDispatcher } from 'svelte'
  import Modal from './Modal.svelte'
  import { validateApexCsvFiles } from '../utils/apexImport.js'
  import { createApexStationDrafts } from '../utils/apexStationDrafts.js'

  const dispatch = createEventDispatcher()

  let fileInput
  let helperOpen = false
  let importing = false
  let errorMessage = ''
  let statusMessage = ''
  let importWarnings = []

  /**
   * Open the local file chooser.
   */
  function openFileChooser () {
    fileInput?.click()
  }

  /**
   * Validate the selected APEX CSV files locally.
   * @param {Event} event - File input change event
   */
  async function handleFilesSelected (event) {
    const input = event.currentTarget
    const files = Array.from(input.files || [])
    input.value = ''

    if (files.length === 0) return

    dispatch('validationstarted')
    importing = true
    errorMessage = ''
    statusMessage = ''
    importWarnings = []

    try {
      const result = await validateApexCsvFiles(files)
      const stationDrafts = createApexStationDrafts(result.groups)
      const warnings = [...result.warnings, ...stationDrafts.warnings]
      importWarnings = warnings
      statusMessage = `Filene er kontrollert lokalt: ${result.trends.length} trends-rader og ${stationDrafts.stations.length} stasjonssekvenser. Ingen data er sendt til backend.`
      dispatch('validated', {
        data: {
          ...result,
          stations: stationDrafts.stations,
          warnings
        }
      })
    } catch (error) {
      console.error('Unable to validate the APEX files', error)
      errorMessage = error instanceof Error
        ? error.message
        : 'En ukjent feil oppstod ved lesing av APEX-filene.'
    } finally {
      importing = false
    }
  }
</script>

<section class='apexImportPanel' aria-labelledby='apex-import-title'>
  <div class='panelCopy'>
    <p class='panelEyebrow'>LOKAL IMPORT</p>
    <h2 id='apex-import-title'>Fyll inn stasjonsdata fra APEX</h2>
    <p>Velg trends-filen. Faults og events kan også velges for å kontrollere at filene hører sammen.</p>
  </div>

  <div class='panelActions'>
    <button
      class='importButton'
      type='button'
      disabled={importing}
      on:click={openFileChooser}
    >
      {importing ? 'Kontrollerer filer …' : 'Importer APEX-data'}
    </button>
    <button
      class='helpButton'
      type='button'
      aria-haspopup='dialog'
      on:click={() => { helperOpen = true }}
    >Hjelp</button>
    <input
      bind:this={fileInput}
      class='fileInput'
      type='file'
      accept='.csv,text/csv'
      multiple
      aria-label='Velg APEX CSV-filer'
      on:change={handleFilesSelected}
    >
  </div>

  {#if statusMessage}
    <p class='importStatus' role='status'>{statusMessage}</p>
  {/if}
  {#if errorMessage}
    <p class='importError' role='alert'>{errorMessage}</p>
  {/if}
  {#if importWarnings.length > 0}
    <div class='importWarnings' role='status' aria-label='Advarsler fra APEX-importen'>
      <strong>{importWarnings.length} verdier krever kontroll:</strong>
      <ul>
        {#each importWarnings as warning}
          <li>{warning.message}</li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

{#if helperOpen}
  <Modal on:close={() => { helperOpen = false }} large={true} labelledBy='apex-helper-title'>
    <div class='helperContent'>
      <p class='panelEyebrow'>SLIK FUNGERER IMPORTEN</p>
      <h2 id='apex-helper-title'>Fra APEX-logg til stasjonsskjema</h2>
      <p class='helperIntro'>
        Velg <code>*_trends.csv</code>. Faults- og events-filene er valgfrie. Data leses lokalt i nettleseren;
        ingenting sendes til backend før skjemaet eventuelt sendes inn.
      </p>

      <div class='helperGrid'>
        <div class='helperSteps'>
          <div class='helperStep'>
            <span>1</span>
            <p><strong>Én timersekvens blir én stasjon.</strong> Nummereringen starter på 1 og øker fortløpende når timeren nullstilles.</p>
          </div>
          <div class='helperStep'>
            <span>2</span>
            <p><strong>GPS og tid hentes fra trends.</strong> Startpunktet bruker timer 5; stoppunkt og sekunder fisket bruker høyeste timerverdi.</p>
          </div>
          <div class='helperStep'>
            <span>3</span>
            <p><strong>Du kontrollerer resultatet.</strong> Volt, puls og display fylles fra loggen. Transektlengden estimeres fra GPS-sporet ved import; ved senere endring av start- eller stoppunkt beregnes den som rett linje mellom punktene. Fisk og feltforhold registreres manuelt.</p>
          </div>
          <p class='manualFields'>
            Manuelle felt: elvetype, vær, temperaturer, ledningsevne og fiskeobservasjoner.
            Stasjonsbeskrivelse står tom.
          </p>
        </div>

        <div class='trendsExample'>
          <div class='exampleHeading'>
            <strong>Eksempel på _trends.csv</strong>
            <span>Utsnitt</span>
          </div>
          <div class='tableScroller'>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Timer (s)</th>
                  <th>Waveform</th>
                  <th>Average Current (A)</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>09:00:00</td><td>0</td><td>1000VDC</td><td>3.8</td><td>61.250000</td><td>10.420000</td>
                </tr>
                <tr class='startSample'>
                  <td>09:00:05</td><td>5</td><td>1000V 40% 120Hz</td><td>4.1</td><td>61.250015</td><td>10.420020</td>
                </tr>
                <tr>
                  <td>09:04:59</td><td>299</td><td>1000V 40% 120Hz</td><td>4.2</td><td>61.252100</td><td>10.423000</td>
                </tr>
                <tr class='stopSample'>
                  <td>09:05:00</td><td>300</td><td>1000V 40% 120Hz</td><td>4.2</td><td>61.252110</td><td>10.423010</td>
                </tr>
                <tr class='resetSample'>
                  <td>09:12:00</td><td>0</td><td>1000VDC</td><td>3.7</td><td>61.253000</td><td>10.424000</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class='exampleLegend'>
            <li><span class='startKey'></span>Timer 5: startkoordinat</li>
            <li><span class='stopKey'></span>Høyeste timer: stoppunkt og sekunder</li>
            <li><span class='resetKey'></span>Timer reset: neste stasjon</li>
          </ul>
          <p class='exampleNote'>Tallene er et illustrerende eksempel. GPS-sporlengden summeres mellom gyldige punkter.</p>
        </div>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .apexImportPanel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px 24px;
    align-items: center;
    margin: 24px 0;
    padding: 22px 24px;
    border: 1px solid #cbd9e8;
    border-left: 5px solid #1565c0;
    border-radius: 12px;
    background: linear-gradient(120deg, #f1f7fd, #fff 72%);
  }

  .panelCopy h2,
  .helperContent h2 {
    margin: 2px 0 6px;
    color: #183b5b;
    font-size: 1.2rem;
  }

  .panelCopy p:last-child,
  .helperIntro {
    margin: 0;
    color: #526477;
    line-height: 1.5;
  }

  .panelEyebrow {
    margin: 0;
    color: #2871ae;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  .panelActions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .importButton,
  .helpButton {
    min-height: 42px;
    padding: 9px 16px;
    border: 1px solid transparent;
    border-radius: 8px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.15s ease, box-shadow 0.15s ease;
  }

  .importButton {
    color: #fff;
    background: #1565c0;
    box-shadow: 0 2px 5px #1565c033;
  }

  .importButton:hover:not(:disabled) {
    background: #0d4f9e;
    box-shadow: 0 3px 9px #1565c044;
  }

  .importButton:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .helpButton {
    color: #174f7d;
    border-color: #a9c2da;
    background: #fff;
  }

  .helpButton:hover {
    background: #e8f2fb;
  }

  .importButton:focus-visible,
  .helpButton:focus-visible {
    outline: 3px solid #f0a33a;
    outline-offset: 2px;
  }

  .fileInput {
    display: none;
  }

  .importStatus,
  .importError,
  .importWarnings {
    grid-column: 1 / -1;
    margin: 0;
    padding: 10px 12px;
    border-radius: 7px;
    font-size: 0.92rem;
    line-height: 1.45;
  }

  .importStatus {
    color: #185a35;
    background: #e8f5ec;
  }

  .importError {
    color: #8e2929;
    background: #fff0ef;
  }

  .importWarnings {
    color: #77521a;
    background: #fff7e5;
  }

  .importWarnings ul {
    margin: 7px 0 0;
    padding-left: 20px;
  }

  .helperContent {
    width: 100%;
    max-height: 72vh;
    overflow: auto;
    padding: 8px 4px;
    color: #293847;
  }

  .helperIntro {
    max-width: 720px;
    margin: 8px 0 20px;
  }

  .helperGrid {
    display: grid;
    grid-template-columns: minmax(210px, 0.8fr) minmax(0, 1.5fr);
    gap: 18px;
    align-items: start;
  }

  .helperSteps {
    display: grid;
    gap: 12px;
  }

  .helperStep {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 9px;
    align-items: start;
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .helperStep > span {
    display: grid;
    width: 26px;
    height: 26px;
    place-items: center;
    border-radius: 50%;
    color: #fff;
    background: #1565c0;
    font-size: 0.8rem;
    font-weight: 800;
  }

  .helperStep p {
    margin: 2px 0 0;
  }

  .manualFields {
    margin: 0;
    padding: 11px 12px;
    border-left: 3px solid #dfa444;
    border-radius: 4px;
    background: #fff7e8;
    color: #6b4c1c;
    font-size: 0.84rem;
    line-height: 1.45;
  }

  .trendsExample {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #d6e0e9;
    border-radius: 9px;
    background: #fff;
  }

  .exampleHeading {
    display: flex;
    justify-content: space-between;
    padding: 10px 12px;
    color: #28445d;
    background: #f2f6fa;
    font-size: 0.83rem;
  }

  .exampleHeading span {
    color: #718396;
    font-size: 0.75rem;
  }

  .tableScroller {
    overflow-x: auto;
  }

  .trendsExample table {
    width: 100%;
    border-collapse: collapse;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.68rem;
    white-space: nowrap;
  }

  .trendsExample th,
  .trendsExample td {
    padding: 8px 9px;
    border-bottom: 1px solid #e7edf2;
    text-align: left;
  }

  .trendsExample th {
    color: #4e6376;
    background: #fafcfd;
    font-family: inherit;
    font-weight: 700;
  }

  .startSample {
    background: #edf6ff;
  }

  .startSample td:first-child,
  .startSample td:nth-child(2) {
    color: #075aa5;
    font-weight: 800;
  }

  .stopSample {
    background: #eff8f0;
  }

  .stopSample td:first-child,
  .stopSample td:nth-child(2) {
    color: #236a33;
    font-weight: 800;
  }

  .resetSample {
    border-top: 2px dashed #c37b19;
    background: #fff7e9;
  }

  .exampleLegend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin: 10px 12px 0;
    padding: 0;
    color: #536779;
    font-size: 0.72rem;
    list-style: none;
  }

  .exampleLegend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .exampleLegend span {
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }

  .startKey { background: #69aee8; }
  .stopKey { background: #71b47e; }
  .resetKey { background: #e5ad57; }

  .exampleNote {
    margin: 10px 12px 12px;
    color: #6b7e8f;
    font-size: 0.72rem;
  }

  @media (max-width: 760px) {
    .apexImportPanel {
      grid-template-columns: 1fr;
      padding: 18px;
    }

    .panelActions {
      flex-wrap: wrap;
    }

    .helperGrid {
      grid-template-columns: 1fr;
    }
  }
</style>
