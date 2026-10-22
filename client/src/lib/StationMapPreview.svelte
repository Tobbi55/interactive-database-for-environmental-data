<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import Modal from './Modal.svelte'
  import {
    createStationMapDrafts,
    formatMapCoordinate,
    getStationMapSnapshot,
    isValidMapPosition,
    loadStationMapResources,
    parseMapCoordinate,
    validateStationMapDrafts
  } from '../utils/stationMapPreview.js'
  import { estimateEditedTransectLength } from '../utils/apexStationDrafts.js'

  export let stations = []

  const dispatch = createEventDispatcher()

  let mapElement
  let map
  let leaflet
  let mapLayers
  let stationLayer
  let draftStations = createStationMapDrafts(stations)
  let initialSnapshot = getStationMapSnapshot(draftStations)
  let isEditing = false
  let attemptedSave = false
  let mapError = ''
  let needsInitialFit = true
  let fitMapOnRefresh = false
  let mapPaneRatio = 0.5
  let isResizingPanels = false
  let mapTableLayoutElement
  let draggedStationKey = null
  let dropTargetStationKey = null

  $: hasChanges = getStationMapSnapshot(draftStations) !== initialSnapshot
  $: validationErrors = validateStationMapDrafts(draftStations)
  $: missingPositionCount = draftStations.reduce((count, station) => count +
    Number(!isValidMapPosition(station.startLat, station.startLong)) +
    Number(!isValidMapPosition(station.endLat, station.endLong)), 0)
  $: if (map && draftStations && isEditing !== undefined) {
    const shouldFitMap = fitMapOnRefresh
    refreshMap(draftStations, isEditing, shouldFitMap)
    fitMapOnRefresh = false
  }

  /**
   * Resize the map/table split while the pointer is held on the separator.
   * @param {PointerEvent} event - Pointer movement in the dialog
   */
  function handlePanelResize (event) {
    if (!isResizingPanels || !mapTableLayoutElement) return

    const bounds = mapTableLayoutElement.getBoundingClientRect()
    const availableHeight = bounds.height - 20
    if (availableHeight <= 0) return

    const relativeY = event.clientY - bounds.top - 10
    mapPaneRatio = Math.max(0.2, Math.min(0.8, relativeY / availableHeight))
    requestAnimationFrame(() => map?.invalidateSize({ pan: false }))
  }

  /**
   * Start or stop resizing the map/table split.
   * @param {PointerEvent} event - Pointer event on the separator
   */
  function startPanelResize (event) {
    event.preventDefault()
    isResizingPanels = true
  }

  /**
   * Stop resizing when the pointer is released or cancelled.
   */
  function stopPanelResize () {
    isResizingPanels = false
  }

  /**
   * Adjust the split with the keyboard for accessible resizing.
   * @param {KeyboardEvent} event - Keyboard event on the separator
   */
  function handlePanelResizeKeydown (event) {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return

    event.preventDefault()
    const change = event.key === 'ArrowUp' ? -0.05 : 0.05
    mapPaneRatio = Math.max(0.2, Math.min(0.8, mapPaneRatio + change))
    requestAnimationFrame(() => map?.invalidateSize({ pan: false }))
  }

  onMount(() => {
    let cancelled = false

    /**
     * Initialize the client-only map after its container is mounted.
     */
    async function initializeMap () {
      try {
        const resources = await loadStationMapResources()
        if (cancelled) return

        leaflet = resources.leaflet
        mapLayers = resources.mapLayers
        map = leaflet.map(mapElement, {
          layers: [mapLayers.Terrain],
          zoomControl: true,
          scrollWheelZoom: true
        })
        stationLayer = leaflet.layerGroup().addTo(map)
        map.setView([61, 12.09], 6)
        refreshMap(draftStations, isEditing)
        requestAnimationFrame(() => map?.invalidateSize())
      } catch (error) {
        console.error('Kunne ikke åpne stasjonskartet', error)
        mapError = 'Kartet kunne ikke åpnes. Du kan fortsatt kontrollere og redigere koordinatene i tabellen.'
      }
    }

    initializeMap()
    return () => {
      cancelled = true
      map?.remove()
    }
  })

  /**
   * Render station endpoints and their labels on the map.
   * @param {object[]} stationDrafts - Current editable station values
   * @param {boolean} editable - Whether map markers can be dragged
   * @param {boolean} fitToStations - Whether to fit map bounds to all valid endpoints
   */
  function refreshMap (stationDrafts, editable, fitToStations = false) {
    if (!map || !stationLayer) return

    stationLayer.clearLayers()
    const positions = []

    stationDrafts.forEach(station => {
      const startValid = isValidMapPosition(station.startLat, station.startLong)
      const endValid = isValidMapPosition(station.endLat, station.endLong)
      const startPosition = startValid
        ? [parseMapCoordinate(station.startLat), parseMapCoordinate(station.startLong)]
        : null
      const endPosition = endValid
        ? [parseMapCoordinate(station.endLat), parseMapCoordinate(station.endLong)]
        : null

      if (startPosition) positions.push(startPosition)
      if (endPosition) positions.push(endPosition)

      if (startPosition && endPosition) {
        leaflet.polyline([startPosition, endPosition], {
          color: '#526879',
          weight: 2,
          opacity: 0.7,
          dashArray: '5, 6'
        }).addTo(stationLayer)
      }

      if (startPosition) {
        addStationMarker(station, 'start', startPosition, editable)
      }
      if (endPosition) {
        addStationMarker(station, 'end', endPosition, editable)
      }
    })

    if (positions.length > 0 && (needsInitialFit || fitToStations)) {
      if (positions.length === 1) {
        map.setView(positions[0], 13)
      } else {
        const bounds = leaflet.latLngBounds(positions)
        const southWest = bounds.getSouthWest()
        const northEast = bounds.getNorthEast()
        if (southWest.equals(northEast)) {
          map.setView(positions[0], 13)
        } else {
          map.fitBounds(bounds.pad(0.15), { maxZoom: 15 })
        }
      }
      needsInitialFit = false
    }
  }

  /**
   * Focus the map on one station's valid endpoints.
   * @param {object} station - Station row to focus
   */
  function zoomToStation (station) {
    if (!map || !leaflet) return

    const positions = [
      isValidMapPosition(station.startLat, station.startLong)
        ? [parseMapCoordinate(station.startLat), parseMapCoordinate(station.startLong)]
        : null,
      isValidMapPosition(station.endLat, station.endLong)
        ? [parseMapCoordinate(station.endLat), parseMapCoordinate(station.endLong)]
        : null
    ].filter(Boolean)

    if (positions.length === 0) return

    map.invalidateSize()
    if (positions.length === 1) {
      map.setView(positions[0], 14)
      return
    }

    const bounds = leaflet.latLngBounds(positions)
    const southWest = bounds.getSouthWest()
    const northEast = bounds.getNorthEast()
    if (southWest.equals(northEast)) {
      map.setView(positions[0], 14)
    } else {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 16 })
    }
  }

  /**
   * Zoom table rows on click without hijacking editable controls.
   * @param {MouseEvent} event - Row click event
   * @param {object} station - Station row to focus
   */
  function handleStationRowClick (event, station) {
    if (event.target instanceof Element && event.target.closest('input, select, textarea, button')) return
    zoomToStation(station)
  }

  /**
   * Support row zoom from the keyboard.
   * @param {KeyboardEvent} event - Row keydown event
   * @param {object} station - Station row to focus
   */
  function handleStationRowKeyDown (event, station) {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return

    event.preventDefault()
    zoomToStation(station)
  }

  /**
   * Start dragging only from the station-row handle.
   * @param {DragEvent} event - Drag start event
   * @param {object} station - Station being dragged
   */
  function handleStationDragStart (event, station) {
    if (!(event.target instanceof Element) || !event.target.closest('.stationDragHandle')) {
      event.preventDefault()
      return
    }

    draggedStationKey = station.key
    event.dataTransfer?.setData('text/plain', String(station.key))
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  /**
   * Allow a dragged station to be dropped over another row.
   * @param {DragEvent} event - Drag over event
   * @param {object} station - Station under the pointer
   */
  function handleStationDragOver (event, station) {
    if (draggedStationKey === null || draggedStationKey === station.key) return

    event.preventDefault()
    dropTargetStationKey = station.key
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  }

  /**
   * Reorder whole station drafts without separating any row values.
   * @param {DragEvent} event - Drop event
   * @param {object} targetStation - Station receiving the dragged row
   */
  function handleStationDrop (event, targetStation) {
    event.preventDefault()
    const sourceIndex = draftStations.findIndex(station => station.key === draggedStationKey)
    const targetIndex = draftStations.findIndex(station => station.key === targetStation.key)

    if (sourceIndex >= 0 && targetIndex >= 0 && sourceIndex !== targetIndex) {
      const reorderedStations = [...draftStations]
      const [draggedStation] = reorderedStations.splice(sourceIndex, 1)
      reorderedStations.splice(targetIndex, 0, draggedStation)
      draftStations = reorderedStations
    }

    clearStationDrag()
  }

  /**
   * Clear drag state after a drag operation ends.
   */
  function clearStationDrag () {
    draggedStationKey = null
    dropTargetStationKey = null
  }

  /**
   * Add a labeled endpoint marker and synchronize its drag position to the draft.
   * @param {object} station - Station draft
   * @param {'start'|'end'} endpoint - Endpoint represented by this marker
   * @param {number[]} position - Latitude and longitude
   * @param {boolean} editable - Whether this marker can be dragged
   */
  function addStationMarker (station, endpoint, position, editable) {
    const isStart = endpoint === 'start'
    const number = station.number || '?'
    const iconElement = document.createElement('span')
    iconElement.className = `stationMapMarker ${isStart ? 'startMarker' : 'endMarker'}`
    iconElement.textContent = isStart ? 'S' : 'T'

    const labelElement = document.createElement('span')
    labelElement.className = 'stationMapLabel'
    labelElement.textContent = `Stasjon ${number} · ${isStart ? 'Start' : 'Stopp'}`

    const marker = leaflet.marker(position, {
      icon: leaflet.divIcon({
        html: iconElement,
        className: 'station-map-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      }),
      draggable: editable,
      keyboard: true,
      title: `Stasjon ${number}, ${isStart ? 'startpunkt' : 'stoppunkt'}`
    }).addTo(stationLayer)

    marker.bindTooltip(labelElement, {
      permanent: true,
      direction: isStart ? 'top' : 'bottom',
      offset: isStart ? [0, -12] : [0, 12],
      className: 'station-map-tooltip'
    })

    if (editable) {
      marker.on('dragend', event => {
        const { lat, lng } = event.target.getLatLng()
        updateDraftField(station.key, isStart ? 'startLat' : 'endLat', formatMapCoordinate(lat))
        updateDraftField(station.key, isStart ? 'startLong' : 'endLong', formatMapCoordinate(lng))
      })
    }
  }

  /**
   * Update one draft field without mutating the add-data form.
   * @param {number} stationKey - Stable station key
   * @param {string} field - Draft field name
   * @param {string} value - New value
   * @param {boolean} fitMap - Whether to refit the map after a valid coordinate change
   */
  function updateDraftField (stationKey, field, value, fitMap = false) {
    draftStations = draftStations.map(station => {
      if (station.key !== stationKey) return station

      const updatedStation = { ...station, [field]: value }
      if (['startLat', 'startLong', 'endLat', 'endLong'].includes(field)) {
        updatedStation.transectLength = hasValidStationEndpoints(updatedStation)
          ? String(estimateEditedTransectLength(updatedStation))
          : ''
      }
      if (fitMap) {
        const endpoint = field.startsWith('start') ? 'start' : 'end'
        fitMapOnRefresh = isValidMapPosition(
          updatedStation[`${endpoint}Lat`],
          updatedStation[`${endpoint}Long`]
        )
      }
      return updatedStation
    })
  }

  /**
   * Enter map editing mode.
   */
  function startEditing () {
    isEditing = true
    attemptedSave = false
    clearStationDrag()
  }

  /**
   * Discard map changes and leave editing mode.
   */
  function cancelEditing () {
    draftStations = createStationMapDrafts(stations)
    initialSnapshot = getStationMapSnapshot(draftStations)
    isEditing = false
    attemptedSave = false
    clearStationDrag()
  }

  /**
   * Save valid map changes back to the add-data page.
   */
  function saveChanges () {
    attemptedSave = true
    if (validationErrors.length > 0) return

    dispatch('save', {
      stations: draftStations.map(station => ({
        key: station.key,
        number: String(Number(station.number)),
        startTime: station.startTime,
        startLat: station.startLat,
        startLong: station.startLong,
        endLat: station.endLat,
        endLong: station.endLong,
        transectLength: hasValidStationEndpoints(station) ? station.transectLength : '',
        secondsFished: station.secondsFished
      }))
    })
    dispatch('close')
  }

  /**
   * Ask before closing if map edits would be discarded.
   */
  function handleModalClose () {
    if (hasChanges && !window.confirm('Forkaste ulagrede endringer i stasjonskartet?')) return
    dispatch('close')
  }

  /**
   * Display a form coordinate or an em dash if it is empty.
   * @param {string} value - Coordinate value
   * @returns {string} Display value
   */
  function displayCoordinate (value) {
    return String(value ?? '').trim() || '—'
  }

  /**
   * Check whether both endpoint coordinate pairs are complete and valid.
   * @param {object} station - Station draft
   * @returns {boolean} Whether both endpoints are valid
   */
  function hasValidStationEndpoints (station) {
    return isValidMapPosition(station.startLat, station.startLong) &&
      isValidMapPosition(station.endLat, station.endLong)
  }
</script>

<svelte:window
  on:pointermove={handlePanelResize}
  on:pointerup={stopPanelResize}
  on:pointercancel={stopPanelResize}
/>

<Modal extraLarge={true} labelledBy='station-map-preview-title' on:close={handleModalClose}>
  <section class='stationMapDialog' aria-label='Forhåndsvis stasjoner i kart'>
    <header class='dialogHeading'>
      <div>
        <p class='eyebrow'>STASJONSOVERSIKT</p>
        <h2 id='station-map-preview-title'>Forhåndsvis stasjoner i kart</h2>
        <p>Start- og stoppunkt vises med stasjonsnummer. Flytt markørene eller rediger koordinatene i tabellen.</p>
      </div>
      {#if !isEditing}
        <button class='primaryButton editButton' type='button' on:click={startEditing}>Rediger</button>
      {/if}
    </header>

    <div class='mapLegend' aria-label='Kartforklaring'>
      <span><i class='legendStart'>S</i> Startpunkt</span>
      <span><i class='legendEnd'>T</i> Stoppunkt</span>
      {#if isEditing}
        <span>Dra markørene for å flytte koordinatene</span>
      {/if}
    </div>

    {#if mapError}
      <p class='mapError' role='alert'>{mapError}</p>
    {/if}
    {#if missingPositionCount > 0}
      <p class='mapNote' role='status'>
        {missingPositionCount} start- eller stoppunkt mangler gyldige koordinater og vises ikke på kartet.
      </p>
    {/if}

    <div
      bind:this={mapTableLayoutElement}
      class='mapTableLayout'
      class:resizing={isResizingPanels}
    >
      <div class='mapPane' style={`flex-grow: ${mapPaneRatio}`}>
        <div bind:this={mapElement} class='stationMap' aria-label='Kart over start- og stoppunkt for stasjonene'></div>
      </div>
      <div
        class='panelSplitter'
        role='slider'
        aria-label='Juster høyde mellom kart og tabell'
        aria-orientation='vertical'
        aria-valuemin='20'
        aria-valuemax='80'
        aria-valuenow={Math.round(mapPaneRatio * 100)}
        aria-valuetext={`Kartet bruker ${Math.round(mapPaneRatio * 100)} prosent av plassen`}
        tabindex='0'
        on:pointerdown={startPanelResize}
        on:keydown={handlePanelResizeKeydown}
      >
        <span></span>
      </div>
      <div class='stationTableWrap' style={`flex-grow: ${1 - mapPaneRatio}`}>
        <table class='stationTable'>
        <thead>
          <tr>
            <th scope='col'>Stasjon</th>
            <th scope='col'>Klokkeslett</th>
            <th scope='col'>Start, lat / long</th>
            <th scope='col'>Stopp, lat / long</th>
            <th scope='col'>Transektlengde</th>
            <th scope='col'>Sekunder fisket</th>
          </tr>
        </thead>
        <tbody>
          {#each draftStations as station, index (station.key)}
            <tr
              class='stationTableRow'
              class:dropTarget={dropTargetStationKey === station.key}
              tabindex='0'
              aria-label={`Zoom til stasjon ${station.number || index + 1} i kartet`}
              on:click={(event) => handleStationRowClick(event, station)}
              on:keydown={(event) => handleStationRowKeyDown(event, station)}
              on:dragstart={(event) => handleStationDragStart(event, station)}
              on:dragover={(event) => handleStationDragOver(event, station)}
              on:drop={(event) => handleStationDrop(event, station)}
              on:dragend={clearStationDrag}
            >
              <th scope='row'>
                <div class='stationCellContent'>
                  {#if isEditing}
                    <button
                      class='stationDragHandle'
                      type='button'
                      draggable='true'
                      aria-label={`Dra stasjon ${station.number} for å flytte raden`}
                      title='Dra for å flytte hele stasjonsraden'
                    >⋮⋮</button>
                    <input
                      class='stationNumberInput'
                      type='number'
                      min='1'
                      step='1'
                      value={station.number}
                      aria-label={`Stasjonsnummer for rad ${index + 1}`}
                      on:input={(event) => updateDraftField(station.key, 'number', event.currentTarget.value)}
                    >
                  {:else}
                    <span class='stationNumberLabel'>Stasjon {station.number || '—'}</span>
                  {/if}
                </div>
              </th>
              <td>
                {#if isEditing}
                  <input
                    type='time'
                    aria-label={`Klokkeslett for stasjon ${station.number || index + 1}`}
                    value={station.startTime}
                    on:input={(event) => updateDraftField(station.key, 'startTime', event.currentTarget.value)}
                  >
                {:else}
                  {station.startTime || '—'}
                {/if}
              </td>
              <td>
                <div class='coordinatePair'>
                  {#if isEditing}
                    <input
                      type='text'
                      inputmode='decimal'
                      autocomplete='off'
                      spellcheck='false'
                      aria-label={`Start breddegrad for stasjon ${station.number || index + 1}`}
                      value={station.startLat}
                      on:input={(event) => updateDraftField(station.key, 'startLat', event.currentTarget.value, true)}
                    >
                    <input
                      type='text'
                      inputmode='decimal'
                      autocomplete='off'
                      spellcheck='false'
                      aria-label={`Start lengdegrad for stasjon ${station.number || index + 1}`}
                      value={station.startLong}
                      on:input={(event) => updateDraftField(station.key, 'startLong', event.currentTarget.value, true)}
                    >
                  {:else}
                    <span>{displayCoordinate(station.startLat)}</span>
                    <span>{displayCoordinate(station.startLong)}</span>
                  {/if}
                </div>
              </td>
              <td>
                <div class='coordinatePair'>
                  {#if isEditing}
                    <input
                      type='text'
                      inputmode='decimal'
                      autocomplete='off'
                      spellcheck='false'
                      aria-label={`Stopp breddegrad for stasjon ${station.number || index + 1}`}
                      value={station.endLat}
                      on:input={(event) => updateDraftField(station.key, 'endLat', event.currentTarget.value, true)}
                    >
                    <input
                      type='text'
                      inputmode='decimal'
                      autocomplete='off'
                      spellcheck='false'
                      aria-label={`Stopp lengdegrad for stasjon ${station.number || index + 1}`}
                      value={station.endLong}
                      on:input={(event) => updateDraftField(station.key, 'endLong', event.currentTarget.value, true)}
                    >
                  {:else}
                    <span>{displayCoordinate(station.endLat)}</span>
                    <span>{displayCoordinate(station.endLong)}</span>
                  {/if}
                </div>
              </td>
              <td>
                {#if isEditing}
                  <input
                    type='number'
                    min='0'
                    step='any'
                    aria-label={`Transektlengde for stasjon ${station.number || index + 1}`}
                    value={hasValidStationEndpoints(station) ? station.transectLength : ''}
                    on:input={(event) => updateDraftField(station.key, 'transectLength', event.currentTarget.value)}
                  >
                {:else}
                  {hasValidStationEndpoints(station) && station.transectLength
                    ? `${station.transectLength} m`
                    : '—'}
                {/if}
              </td>
              <td>
                {#if isEditing}
                  <input
                    type='number'
                    min='0'
                    step='any'
                    aria-label={`Sekunder fisket for stasjon ${station.number || index + 1}`}
                    value={station.secondsFished}
                    on:input={(event) => updateDraftField(station.key, 'secondsFished', event.currentTarget.value)}
                  >
                {:else}
                  {station.secondsFished || '—'}
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
        </table>
      </div>
    </div>

    {#if attemptedSave && validationErrors.length > 0}
      <div class='validationErrors' role='alert'>
        <strong>Rett opp følgende før du lagrer:</strong>
        <ul>
          {#each validationErrors as error}
            <li>{error}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if isEditing}
      <footer class='dialogActions'>
        <button class='secondaryButton' type='button' on:click={cancelEditing}>Avbryt redigering</button>
        <button class='primaryButton' type='button' on:click={saveChanges}>Lagre endringer</button>
      </footer>
    {/if}
  </section>
</Modal>

<style>
  @import 'leaflet/dist/leaflet.css';

  .stationMapDialog {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    width: 100%;
    min-height: 0;
    max-height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.5rem;
    gap: 0.75rem;
  }

  .stationMapDialog > * {
    flex-shrink: 0;
  }

  .stationMapDialog > .mapTableLayout {
    flex-shrink: 1;
  }

  .dialogHeading h2 {
    margin: 0;
    color: var(--PCOLOR);
    font-size: 1.35rem;
  }

  .dialogHeading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding-right: 2.5rem;
  }

  .editButton {
    flex: 0 0 auto;
    margin-top: 0.25rem;
  }

  .dialogHeading p:last-child {
    margin: 0.4rem 2.25rem 0 0;
    line-height: 1.45;
  }

  .eyebrow {
    margin: 0 0 0.25rem;
    color: var(--SCOLOR);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .mapLegend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem 1.25rem;
    font-size: 0.9rem;
  }

  .mapLegend span {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .legendStart,
  .legendEnd {
    display: inline-grid;
    width: 1.4rem;
    height: 1.4rem;
    place-items: center;
    border-radius: 50%;
    color: white;
    font-size: 0.7rem;
    font-style: normal;
    font-weight: 800;
  }

  .legendStart {
    background: #197148;
  }

  .legendEnd {
    background: #1766a0;
  }

  .mapTableLayout {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .mapPane,
  .stationTableWrap {
    flex-basis: 0;
    min-height: 0;
  }

  .mapPane {
    display: flex;
    overflow: hidden;
  }

  .stationMap {
    flex: 1 1 0;
    width: 100%;
    min-height: 0;
    border: 1px solid #d2dae0;
    border-radius: 0.5rem;
    background: #eef2f3;
  }

  .panelSplitter {
    display: flex;
    flex: 0 0 20px;
    align-items: center;
    justify-content: center;
    cursor: row-resize;
    touch-action: none;
    outline-offset: -2px;
  }

  .panelSplitter span {
    width: 3.5rem;
    height: 4px;
    border-radius: 2px;
    background: #aab5bd;
    transition: background-color 120ms ease, width 120ms ease;
  }

  .panelSplitter:hover span,
  .panelSplitter:focus-visible span,
  .mapTableLayout.resizing .panelSplitter span {
    width: 5rem;
    background: var(--PCOLOR);
  }

  .mapTableLayout.resizing {
    user-select: none;
  }

  .mapNote,
  .mapError {
    margin: 0;
    padding: 0.65rem 0.8rem;
    border-radius: 0.35rem;
    background: #fff7e6;
    line-height: 1.4;
  }

  .mapError,
  .validationErrors {
    background: #fff1ef;
    color: #7a2018;
  }

  .stationTableWrap {
    overflow: auto;
    border: 1px solid #dce2e6;
    border-radius: 0.4rem;
    overscroll-behavior: contain;
  }

  .stationTable {
    width: 100%;
    height: 100%;
    border-collapse: collapse;
    font-size: 0.84rem;
    white-space: nowrap;
  }

  .stationTable th,
  .stationTable td {
    padding: 0.5rem;
    border-bottom: 1px solid #e5e9ec;
    text-align: left;
  }

  .stationTable td > input {
    box-sizing: border-box;
    width: 100%;
    min-width: 6rem;
    padding: 0.35rem;
    border: 1px solid #c6d0d7;
    border-radius: 0.3rem;
    font: inherit;
  }

  .stationTable td > input:focus {
    border-color: var(--PCOLOR);
    outline: 2px solid rgb(67 87 104 / 20%);
  }

  .stationTableRow {
    cursor: pointer;
  }

  .stationTableRow:hover {
    background: #f4f8fa;
  }

  .stationTableRow.dropTarget {
    box-shadow: inset 0 3px 0 var(--PCOLOR);
  }

  .stationTableRow:focus-visible {
    outline: 2px solid var(--PCOLOR);
    outline-offset: -2px;
  }

  .stationTable thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #f1f4f6;
  }

  .stationNumberLabel {
    color: var(--PCOLOR);
    font-weight: 800;
  }

  .coordinatePair {
    display: flex;
    gap: 0.35rem;
  }

  .coordinatePair input {
    width: 6.8rem;
    min-width: 0;
    padding: 0.35rem;
    border: 1px solid #c6d0d7;
    border-radius: 0.3rem;
    font: inherit;
  }

  .coordinatePair input:focus,
  .stationNumberInput:focus {
    border-color: var(--PCOLOR);
    outline: 2px solid rgb(67 87 104 / 20%);
  }

  .stationNumberInput {
    width: 5rem;
    padding: 0.35rem;
    border: 1px solid #c6d0d7;
    border-radius: 0.3rem;
    font: inherit;
  }

  .stationCellContent {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .stationDragHandle {
    padding: 0.25rem;
    border: 1px solid #c6d0d7;
    border-radius: 0.3rem;
    background: #f1f4f6;
    color: #344957;
    cursor: grab;
    font: inherit;
    font-weight: 800;
    line-height: 1;
    touch-action: none;
  }

  .stationDragHandle:active {
    cursor: grabbing;
  }

  .validationErrors {
    padding: 0.75rem 1rem;
    border-radius: 0.35rem;
  }

  .validationErrors ul {
    margin: 0.4rem 0 0;
    padding-left: 1.2rem;
  }

  .dialogActions {
    display: flex;
    justify-content: flex-end;
    gap: 0.65rem;
    padding: 0.2rem 0 0.35rem;
  }

  .primaryButton,
  .secondaryButton {
    padding: 0.65rem 1rem;
    border: 1px solid var(--PCOLOR);
    border-radius: 0.4rem;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }

  .primaryButton {
    background: var(--PCOLOR);
    color: white;
  }

  .secondaryButton {
    background: white;
    color: var(--PCOLOR);
  }

  .stationMap :global(.station-map-icon) {
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
  }

  .stationMap :global(.stationMapMarker) {
    display: grid;
    width: 1.65rem;
    height: 1.65rem;
    place-items: center;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 1px 5px rgb(0 0 0 / 55%);
    color: white;
    font-size: 0.75rem;
    font-weight: 800;
  }

  .stationMap :global(.startMarker) {
    background: #197148;
  }

  .stationMap :global(.endMarker) {
    background: #1766a0;
  }

  .stationMap :global(.station-map-tooltip) {
    border: 0;
    border-radius: 0.25rem;
    background: #fff;
    box-shadow: 0 1px 4px rgb(0 0 0 / 35%);
    color: #17212a;
    font-size: 0.78rem;
    font-weight: 800;
    white-space: nowrap;
  }

  @media (max-width: 700px) {
    .stationMapDialog {
      padding: 0.25rem;
    }

    .coordinatePair input {
      width: 5.4rem;
    }

    .dialogActions {
      position: sticky;
      bottom: 0;
      padding: 0.5rem 0;
      background: white;
    }
  }
</style>
