<script>
  import ApexImportPanel from '$lib/ApexImportPanel.svelte'
  import Modal from '$lib/Modal.svelte'
  import StationMapPreview from '$lib/StationMapPreview.svelte'
  import Button from '$lib/user-input/Button.svelte'
  import { norwegianFreshwaterFish } from '$lib/norwegianFreshwaterFish.js'
  import { estimateEditedTransectLength, mergeApexStationDraft } from '../../utils/apexStationDrafts.js'
  import { isValidMapPosition, validateStationMapDrafts } from '../../utils/stationMapPreview.js'

  const boatTypes = ['Cataraft', 'Volt Maria']
  const weatherTypes = ['Regn', 'Snø', 'Sol', 'Opphold', 'Lettskyet']
  const riverTypes = ['Stilleflytende', 'Glattstrøm', 'Innsjø', 'Stryk', 'Bakevje']
  const yesNoOptions = ['Ja', 'Nei']
  const genderOptions = ['M', 'F']
  const hourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
  const minuteOptions = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))
  const commaDecimalPattern = /^-?\d*(,\d*)?$/
  const stationCoordinateFields = new Set(['startLat', 'startLong', 'endLat', 'endLong'])

  const riverFields = [
    { key: 'startDate', label: 'Start dato', type: 'date', required: true },
    { key: 'endDate', label: 'Slutt dato', type: 'date', required: true },
    { key: 'riverName', label: 'Elv', type: 'text', required: true },
    { key: 'boatType', label: 'Båttype', type: 'select', options: boatTypes, required: true },
    { key: 'latitude', label: 'Lat', type: 'commaDecimal', hint: '(bruk komma, ikke punktum)', required: true },
    { key: 'longitude', label: 'Long', type: 'commaDecimal', hint: '(bruk komma, ikke punktum)', required: true },
    { key: 'waterflow', label: 'Vannføring (sildre.no)', type: 'number', step: 'any' },
    { key: 'skipper', label: 'Skipper', type: 'text', required: true },
    { key: 'crew1', label: 'Mannskap 1', type: 'text' },
    { key: 'crew2', label: 'Mannskap 2', type: 'text' },
    { key: 'crew3', label: 'Mannskap 3', type: 'text' },
    { key: 'project', label: 'Prosjekt', type: 'text' },
    { key: 'projectNumber', label: 'Prosjektnummer', type: 'text', required: true },
    { key: 'comment', label: 'Kommentar', type: 'textarea', wide: true }
  ]

  const stationFields = [
    { key: 'number', label: 'Stasjon', type: 'number', step: '1', min: '1', required: true },
    { key: 'boatType', label: 'Båttype', type: 'select', options: boatTypes, required: true },
    { key: 'date', label: 'Dato', type: 'date', required: true },
    { key: 'startTime', label: 'Klokkeslett start', type: 'time24', hint: '(24-timers klokke)', required: true },
    { key: 'startLat', label: 'Lat start', type: 'commaDecimal', hint: '(bruk komma, ikke punktum)', required: true },
    { key: 'startLong', label: 'Long start', type: 'commaDecimal', hint: '(bruk komma, ikke punktum)', required: true },
    { key: 'endLat', label: 'Lat stopp', type: 'commaDecimal', hint: '(bruk komma, ikke punktum)', required: true },
    { key: 'endLong', label: 'Long stopp', type: 'commaDecimal', hint: '(bruk komma, ikke punktum)', required: true },
    { key: 'riverType', label: 'Dominerende elvetype', type: 'select', options: riverTypes },
    { key: 'weather', label: 'Vær', type: 'select', options: weatherTypes },
    { key: 'waterTemp', label: 'Vanntemp (Celsius)', type: 'commaDecimal', hint: '(bruk komma, ikke punktum)' },
    { key: 'airTemp', label: 'Lufttemperatur (Celsius)', type: 'number', step: 'any' },
    { key: 'conductivity', label: 'Ledningsevne (µs/cm)', type: 'number', step: 'any' },
    { key: 'transectLength', label: 'Transektlengde (m)', type: 'number', step: 'any', hint: '(ved import: GPS-spor; etter koordinatendring: rett linje)' },
    { key: 'secondsFished', label: 'Sekunder fisket (s)', type: 'number', step: 'any', required: true },
    { key: 'voltage', label: 'Volt', type: 'number', step: 'any', required: true },
    { key: 'pulse', label: 'Puls (DC)', type: 'number', step: 'any', required: true },
    { key: 'display', label: 'Display', type: 'number', step: 'any' },
    { key: 'gpxFile', label: 'Gpx file?', type: 'text' },
    { key: 'description', label: 'Stasjonsbeskrivelse', type: 'textarea', wide: true },
    { key: 'comment', label: 'Kommentarer til fiske (observasjoner osv)', type: 'textarea', wide: true }
  ]

  const defaultObservationRows = 10
  const fillableObservationFields = new Set(['round', 'species', 'count', 'age', 'released', 'sampled'])
  const observationFields = [
    { key: 'round', label: 'Omgang', type: 'number', step: '1', min: '0' },
    { key: 'species', label: 'Art', type: 'text', required: true },
    { key: 'length', label: 'Lengde', type: 'number', step: 'any', min: '0' },
    { key: 'count', label: 'Antall', type: 'number', step: '1', min: '0' },
    { key: 'gender', label: 'Kjønn', type: 'select', options: genderOptions },
    { key: 'age', label: 'Alder', type: 'number', step: '1', min: '0' },
    { key: 'released', label: 'Gjenutsatt (ja/nei)', type: 'select', options: yesNoOptions },
    { key: 'sampled', label: 'Prøvetatt (ja/nei)', type: 'select', options: yesNoOptions },
    { key: 'comment', label: 'Kommentar', type: 'textarea', wide: true }
  ]

  let riverData = Object.fromEntries(riverFields.map(field => [field.key, '']))
  let riverInfoExpanded = true
  let stationInfoExpandedByKey = {}
  let observationsExpandedByStationKey = {}
  let nextStationKey = 1
  let nextObservationKey = 1
  let stations = [createStation(1)]
  let pendingApexImport = null
  let apexImportMessage = ''
  let apexImportError = ''
  let stationMapPreviewOpen = false
  let stationMapMessage = ''
  let stationMapError = ''
  let fillSource = null
  let fillTarget = null
  let activeSpeciesObservationKey = null
  let activeSpeciesInput = null
  let speciesSearchQuery = ''
  let speciesSearchHasInput = false
  let highlightedSpeciesIndex = -1

  $: filteredFreshwaterFish = speciesSearchHasInput
    ? norwegianFreshwaterFish.filter(({ label }) => label.toLocaleLowerCase('nb').includes(speciesSearchQuery.trim().toLocaleLowerCase('nb')))
    : norwegianFreshwaterFish
  $: allStationInfoExpanded = stations.length > 0 &&
    stations.every(station => stationInfoExpandedByKey[station.key] !== false)
  $: allObservationsExpanded = stations.length > 0 &&
    stations.every(station => observationsExpandedByStationKey[station.key] !== false)

  /**
   * Creates an empty observation row.
   * @returns {object} The empty observation
   */
  function createEmptyObservation () {
    return {
      key: nextObservationKey++,
      id: null,
      round: '',
      species: '',
      length: '',
      count: '',
      gender: '',
      age: '',
      released: '',
      sampled: '',
      comment: ''
    }
  }

  /**
   * Creates a station form model with the next station number.
   * @param {number} number - The station number
   * @returns {object} The station form model
   */
  function createStation (number) {
    return {
      key: nextStationKey++,
      number: String(number),
      boatType: '',
      startTime: '',
      startHour: '',
      startMinute: '',
      observations: Array.from({ length: defaultObservationRows }, createEmptyObservation)
    }
  }

  /**
   * Rejects decimal points and values that are not valid comma-decimal input.
   * @param {Event} event - The input event
   * @param {string} fieldKey - The field being edited
   * @param {number|null} stationKey - The station key, or null for river data
   */
  function updateCommaDecimal (event, fieldKey, stationKey = null) {
    const input = event.currentTarget
    const previousValue = stationKey === null
      ? riverData[fieldKey]
      : stations.find(station => station.key === stationKey)?.[fieldKey] ?? ''

    if (!commaDecimalPattern.test(input.value)) {
      input.value = previousValue
      input.setCustomValidity('Skriv desimaltall med komma, for eksempel 60,123. Punktum godtas ikke.')
      input.reportValidity()
      return
    }

    input.setCustomValidity('')
    if (stationKey === null) {
      riverData = { ...riverData, [fieldKey]: input.value }
      return
    }

    stations = stations.map(station => {
      if (station.key !== stationKey) return station

      const updatedStation = { ...station, [fieldKey]: input.value }
      if (stationCoordinateFields.has(fieldKey)) {
        updatedStation.transectLength = isValidMapPosition(updatedStation.startLat, updatedStation.startLong) &&
          isValidMapPosition(updatedStation.endLat, updatedStation.endLong)
          ? String(estimateEditedTransectLength(updatedStation))
          : ''
      }
      return updatedStation
    })
  }

  /**
   * Prevents keyboard entry of a decimal point in comma-decimal fields.
   * @param {KeyboardEvent} event - The keyboard event
   */
  function preventDecimalPoint (event) {
    if (event.key === '.' || event.key === 'Decimal') {
      event.preventDefault()
    }
  }

  /**
   * Keeps the station's stored time synchronized with its 24-hour selectors.
   * @param {number} stationKey - The station key
   * @param {'startHour'|'startMinute'} part - The time component being changed
   * @param {string} value - The selected hour or minute
   */
  function updateTimePart (stationKey, part, value) {
    stations = stations.map(station => {
      if (station.key !== stationKey) return station

      const updatedStation = { ...station, [part]: value }
      updatedStation.startTime = updatedStation.startHour && updatedStation.startMinute
        ? `${updatedStation.startHour}:${updatedStation.startMinute}`
        : ''
      return updatedStation
    })
  }

  /**
   * Checks whether an observation row contains any entered data.
   * @param {object} observation - The observation to inspect
   * @returns {boolean} Whether the row contains data
   */
  function observationHasData (observation) {
    return observationFields.some(field => String(observation[field.key] ?? '').trim() !== '')
  }

  /**
   * Reassigns sequential numeric IDs to non-empty observations.
   * @param {object[]} stationList - Stations to number
   * @returns {object[]} Stations with updated observation IDs
   */
  function renumberObservationIds (stationList) {
    let nextId = 1
    return stationList.map(station => ({
      ...station,
      observations: station.observations.map(observation => ({
        ...observation,
        id: observationHasData(observation) ? nextId++ : null
      }))
    }))
  }

  /**
   * Check whether removing a station would discard entered form or fish data.
   * @param {object} station - The station to inspect
   * @returns {boolean} Whether the station contains user data
   */
  function stationHasEnteredData (station) {
    return stationFields.some(field => field.key !== 'number' &&
      String(station[field.key] ?? '').trim() !== '') ||
      station.observations.some(observationHasData)
  }

  /**
   * Check whether empty station fields should be highlighted.
   * @param {object} station - The station being checked
   * @returns {boolean} Whether the station number and boat type are set
   */
  function shouldHighlightEmptyStationFields (station) {
    return String(station.number ?? '').trim() !== '' &&
      String(station.boatType ?? '').trim() !== ''
  }

  /**
   * Check whether a station field is empty after the station is started.
   * @param {object} station - The station being checked
   * @param {string} fieldKey - The station field key
   * @returns {boolean} Whether the field should be highlighted
   */
  function isStationFieldMissing (station, fieldKey) {
    return shouldHighlightEmptyStationFields(station) &&
      String(station[fieldKey] ?? '').trim() === ''
  }

  /**
   * Return whether one station's details are expanded.
   * @param {number} stationKey - Stable station key
   * @returns {boolean} Whether the station details are expanded
   */
  function isStationInfoExpanded (stationKey) {
    return stationInfoExpandedByKey[stationKey] !== false
  }

  /**
   * Return whether one station's fish observations are expanded.
   * @param {number} stationKey - Stable station key
   * @returns {boolean} Whether the observation table is expanded
   */
  function areObservationsExpanded (stationKey) {
    return observationsExpandedByStationKey[stationKey] !== false
  }

  /**
   * Toggle one station's details.
   * @param {number} stationKey - Stable station key
   */
  function toggleStationInfo (stationKey) {
    stationInfoExpandedByKey = {
      ...stationInfoExpandedByKey,
      [stationKey]: !isStationInfoExpanded(stationKey)
    }
  }

  /**
   * Toggle one station's fish observation table.
   * @param {number} stationKey - Stable station key
   */
  function toggleObservations (stationKey) {
    observationsExpandedByStationKey = {
      ...observationsExpandedByStationKey,
      [stationKey]: !areObservationsExpanded(stationKey)
    }
  }

  /**
   * Expand all station details unless all are already expanded.
   */
  function toggleAllStationInfo () {
    const expandAll = !allStationInfoExpanded
    stationInfoExpandedByKey = Object.fromEntries(
      stations.map(station => [station.key, expandAll])
    )
  }

  /**
   * Expand all observation tables unless all are already expanded.
   */
  function toggleAllObservations () {
    const expandAll = !allObservationsExpanded
    observationsExpandedByStationKey = Object.fromEntries(
      stations.map(station => [station.key, expandAll])
    )
  }

  /**
   * Apply generated APEX values while preserving existing manual station data.
   * @param {object[]} drafts - Generated station drafts
   * @param {object[]} warnings - Import warnings
   */
  function applyApexImport (drafts, warnings) {
    const existingStations = stations
    const importedStations = drafts.map((draft, index) => {
      const station = existingStations[index] || createStation(index + 1)
      return mergeApexStationDraft(station, draft)
    })

    stations = renumberObservationIds(importedStations)
    pendingApexImport = null
    apexImportMessage = `APEX-data er importert i ${drafts.length} stasjoner. APEX-feltene er oppdatert; manuelle felt og fiskeobservasjoner i stasjonene som beholdes, er bevart.${warnings.length > 0 ? ' Kontroller advarslene fra importen.' : ''}`
    apexImportError = ''
  }

  /**
   * Clear feedback from a previous import when a new file selection begins.
   */
  function clearApexImportMessages () {
    apexImportMessage = ''
    apexImportError = ''
  }

  /**
   * Handle validated local APEX data from the import panel.
   * @param {CustomEvent} event - The validated import event
   */
  function handleApexValidated (event) {
    apexImportMessage = ''
    apexImportError = ''
    const data = event.detail?.data

    if (!Array.isArray(data?.stations) || data.stations.length === 0 || !Array.isArray(data.warnings)) {
      apexImportError = 'APEX-importen ga ikke gyldige stasjonsutkast. Kontroller filene og prøv igjen.'
      console.error('Ugyldig APEX-importresultat mottatt fra importpanelet', data)
      return
    }

    const drafts = data.stations
    const warnings = data.warnings
    const removedStations = stations.slice(drafts.length)
    const stationsWithData = removedStations.filter(stationHasEnteredData)

    if (drafts.length < stations.length && stationsWithData.length > 0) {
      pendingApexImport = {
        drafts,
        warnings,
        removedStationCount: removedStations.length,
        stationsWithDataCount: stationsWithData.length
      }
      return
    }

    try {
      applyApexImport(drafts, warnings)
    } catch (error) {
      console.error('Kunne ikke fylle stasjonsskjemaet med APEX-data', error)
      apexImportError = error instanceof Error
        ? error.message
        : 'En ukjent feil oppstod da APEX-dataene skulle fylles inn.'
    }
  }

  /**
   * Cancel a pending import that would remove stations containing user data.
   */
  function cancelPendingApexImport () {
    pendingApexImport = null
    apexImportMessage = 'Importen ble avbrutt. Eksisterende stasjoner og data er beholdt.'
  }

  /**
   * Confirm and apply a pending import that removes data-filled stations.
   */
  function confirmPendingApexImport () {
    const pendingImport = pendingApexImport
    if (!pendingImport) return

    try {
      applyApexImport(pendingImport.drafts, pendingImport.warnings)
    } catch (error) {
      console.error('Kunne ikke fylle stasjonsskjemaet med APEX-data', error)
      pendingApexImport = null
      apexImportError = error instanceof Error
        ? error.message
        : 'En ukjent feil oppstod da APEX-dataene skulle fylles inn.'
    }
  }

  /**
   * Creates a station-scoped display reference for an observation.
   * @param {object} station - The station containing the observation
   * @param {number} observationIndex - The observation row index
   * @returns {string} The display reference, or an empty string for a blank row
   */
  function observationReference (station, observationIndex) {
    const observation = station.observations[observationIndex]
    if (!observationHasData(observation) || !station.number) return ''

    const stationFishNumber = station.observations
      .slice(0, observationIndex + 1)
      .filter(observationHasData)
      .length

    return `${station.number}-${stationFishNumber}`
  }

  /**
   * Updates an observation field and refreshes numeric IDs.
   * @param {number} stationKey - The station key
   * @param {number} observationKey - The observation key
   * @param {string} fieldKey - The observation field to update
   * @param {string} value - The new field value
   */
  function updateObservation (stationKey, observationKey, fieldKey, value) {
    const updatedStations = stations.map(station => station.key === stationKey
      ? {
          ...station,
          observations: station.observations.map(observation => observation.key === observationKey
            ? { ...observation, [fieldKey]: value }
            : observation)
        }
      : station)
    stations = renumberObservationIds(updatedStations)
  }

  /**
   * Opens the canonical species list for an observation cell.
   * @param {number} observationKey - The observation row key
   * @param {string} selectedValue - The currently selected species label
   * @param {FocusEvent} event - The focus event
   */
  function openSpeciesOptions (observationKey, selectedValue, event) {
    activeSpeciesObservationKey = observationKey
    activeSpeciesInput = event.currentTarget
    speciesSearchQuery = selectedValue
    speciesSearchHasInput = false
    highlightedSpeciesIndex = -1
    activeSpeciesInput.setCustomValidity('')
    activeSpeciesInput.select()
  }

  /**
   * Filters the species list while requiring the user to choose a listed value.
   * @param {InputEvent} event - The input event
   */
  function updateSpeciesSearch (event) {
    speciesSearchQuery = event.currentTarget.value
    speciesSearchHasInput = true
    highlightedSpeciesIndex = -1
    event.currentTarget.setCustomValidity('Velg en art fra den godkjente listen.')
  }

  /**
   * Saves a selected canonical species and closes the suggestion list.
   * @param {number} stationKey - The station key
   * @param {number} observationKey - The observation row key
   * @param {object} species - The selected species
   */
  function selectSpecies (stationKey, observationKey, species) {
    updateObservation(stationKey, observationKey, 'species', species.name)
    closeSpeciesOptions()
  }

  /**
   * Handles keyboard navigation and selection in the species list.
   * @param {KeyboardEvent} event - The keyboard event
   * @param {number} stationKey - The station key
   * @param {number} observationKey - The observation row key
   */
  function handleSpeciesKeydown (event, stationKey, observationKey) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSpeciesOptions()
      return
    }

    if (!filteredFreshwaterFish.length) {
      if (event.key === 'Enter') event.preventDefault()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      highlightedSpeciesIndex = (highlightedSpeciesIndex + 1) % filteredFreshwaterFish.length
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      highlightedSpeciesIndex = highlightedSpeciesIndex < 0
        ? filteredFreshwaterFish.length - 1
        : (highlightedSpeciesIndex - 1 + filteredFreshwaterFish.length) % filteredFreshwaterFish.length
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const speciesIndex = highlightedSpeciesIndex >= 0
        ? highlightedSpeciesIndex
        : speciesSearchHasInput && filteredFreshwaterFish.length === 1
          ? 0
          : -1
      if (speciesIndex >= 0) {
        selectSpecies(stationKey, observationKey, filteredFreshwaterFish[speciesIndex])
      }
    }
  }

  /**
   * Closes the species list and discards unselected search text.
   */
  function closeSpeciesOptions () {
    activeSpeciesInput?.setCustomValidity('')
    activeSpeciesObservationKey = null
    activeSpeciesInput = null
    speciesSearchQuery = ''
    speciesSearchHasInput = false
    highlightedSpeciesIndex = -1
  }

  /**
   * Starts a downward fill operation from a populated cell.
   * @param {number} stationKey - The station key
   * @param {number} observationKey - The source observation key
   * @param {string} fieldKey - The field to copy
   * @param {PointerEvent} event - The pointer event
   */
  function startFill (stationKey, observationKey, fieldKey, event) {
    event.preventDefault()
    event.stopPropagation()

    const source = stations
      .find(station => station.key === stationKey)
      ?.observations.find(observation => observation.key === observationKey)

    if (!source || source[fieldKey] === '' || source[fieldKey] == null) return

    fillSource = { stationKey, observationKey, fieldKey }
    fillTarget = observationKey
  }

  /**
   * Tracks the row currently under the pointer during a fill operation.
   * @param {number} stationKey - The station key
   * @param {number} observationKey - The target observation key
   */
  function updateFillTarget (stationKey, observationKey) {
    if (fillSource?.stationKey === stationKey) {
      fillTarget = observationKey
    }
  }

  /**
   * Copies the source cell into rows below the source through the target row.
   */
  function finishFill () {
    if (!fillSource) return

    const { stationKey, observationKey, fieldKey } = fillSource
    const station = stations.find(station => station.key === stationKey)
    const sourceIndex = station?.observations.findIndex(observation => observation.key === observationKey) ?? -1
    const targetIndex = station?.observations.findIndex(observation => observation.key === fillTarget) ?? -1

    if (station && sourceIndex >= 0 && targetIndex > sourceIndex) {
      const value = station.observations[sourceIndex][fieldKey]
      stations = renumberObservationIds(stations.map(item => item.key === stationKey
        ? {
            ...item,
            observations: item.observations.map((observation, index) => index > sourceIndex && index <= targetIndex
              ? { ...observation, [fieldKey]: value }
              : observation)
          }
        : item))
    }

    fillSource = null
    fillTarget = null
  }

  /**
   * Clears a fill operation cancelled by the browser.
   */
  function cancelFill () {
    fillSource = null
    fillTarget = null
  }

  /**
   * Adds a station with the next available number.
   */
  function addStation () {
    const nextNumber = Math.max(0, ...stations.map(station => Number(station.number) || 0)) + 1
    stations = [...stations, createStation(nextNumber)]
  }

  /**
   * Removes a station and its observations.
   * @param {number} stationKey - The station key
   */
  function removeStation (stationKey) {
    stations = renumberObservationIds(stations.filter(station => station.key !== stationKey))
  }

  /**
   * Save validated station numbers and coordinates from the map preview.
   * @param {CustomEvent} event - Map preview save event
   */
  function handleStationMapSave (event) {
    const updates = event.detail?.stations
    const stationKeys = new Set(stations.map(station => station.key))
    const updateKeys = new Set(Array.isArray(updates) ? updates.map(station => station.key) : [])

    if (!Array.isArray(updates) ||
      updates.length !== stations.length ||
      updateKeys.size !== updates.length ||
      updates.some(update => !stationKeys.has(update.key)) ||
      stationKeys.size !== updateKeys.size) {
      stationMapError = 'Kartendringene kunne ikke knyttes til stasjonene. Lukk kartet og prøv igjen.'
      console.error('Ugyldig stasjonsliste mottatt fra kartforhåndsvisningen', updates)
      return
    }

    const validationErrors = validateStationMapDrafts(updates)
    if (validationErrors.length > 0) {
      stationMapError = `Kartendringene er ugyldige: ${validationErrors.join(' ')}`
      console.error('Kartforhåndsvisningen sendte ugyldige stasjonsverdier', validationErrors)
      return
    }

    const stationsByKey = new Map(stations.map(station => [station.key, station]))
    stations = updates.map(update => {
      const station = stationsByKey.get(update.key)
      const startTime = String(update.startTime ?? '')
      const timeParts = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime)
      const startLat = String(update.startLat ?? '')
      const startLong = String(update.startLong ?? '')
      const endLat = String(update.endLat ?? '')
      const endLong = String(update.endLong ?? '')
      const hasValidEndpoints = isValidMapPosition(startLat, startLong) &&
        isValidMapPosition(endLat, endLong)
      return {
        ...station,
        number: String(update.number),
        startTime,
        startHour: timeParts?.[1] ?? '',
        startMinute: timeParts?.[2] ?? '',
        startLat,
        startLong,
        endLat,
        endLong,
        transectLength: hasValidEndpoints ? String(update.transectLength ?? '') : '',
        secondsFished: String(update.secondsFished ?? '')
      }
    })

    stationMapError = ''
    stationMapMessage = 'Stasjonsinformasjonen fra kartet er lagret i skjemaet.'
  }

  /**
   * Adds one or more empty observation rows to a station.
   * @param {number} stationKey - The station key
   * @param {number} count - The number of rows to add
   */
  function addObservationRows (stationKey, count) {
    stations = stations.map(station => station.key === stationKey
      ? { ...station, observations: [...station.observations, ...Array.from({ length: count }, createEmptyObservation)] }
      : station)
  }

  /**
   * Removes an observation from a station.
   * @param {number} stationKey - The station key
   * @param {number} observationKey - The observation key
   */
  function removeObservation (stationKey, observationKey) {
    stations = renumberObservationIds(stations.map(station => station.key === stationKey
      ? { ...station, observations: station.observations.filter(observation => observation.key !== observationKey) }
      : station))
  }
</script>

<svelte:head>
  <title>Legg inn data</title>
  <meta name='description' content='Legg inn elve-, stasjons- og fiskeobservasjonsdata manuelt.'>
</svelte:head>

<svelte:window on:pointerup={finishFill} on:pointercancel={cancelFill} />

<main class='manualEntryPage'>
  <div class='pageContent'>
    <header class='pageIntro'>
      <p class='eyebrow'>REGISTRERING AV MILJØDATA</p>
      <h1>Legg inn data</h1>
      <p>
        Registrer elveinformasjon, én eller flere stasjoner og fiskeobservasjoner uten å fylle ut Excel-arket.
        Feltene følger oppsettet i <a href='/importmal.xlsx' download='importmal.xlsx'>importmalen</a>.
      </p>
    </header>

    <aside class='formNotice' aria-label='Informasjon om skjemaet'>
      <strong>Dette er et utkast</strong>
      <span>Felt merket med <span class='requiredMark'>*</span> er påkrevd i importmalen. Innsending kobles til i et senere steg.</span>
    </aside>

    <ApexImportPanel
      on:validationstarted={clearApexImportMessages}
      on:validated={handleApexValidated}
    />
    {#if apexImportMessage}
      <p class='apexImportMessage' role='status'>{apexImportMessage}</p>
    {/if}
    {#if apexImportError}
      <p class='apexImportError' role='alert'>{apexImportError}</p>
    {/if}

    {#if pendingApexImport}
      <Modal on:close={cancelPendingApexImport} labelledBy='apex-import-confirm-title'>
        <div class='importConfirmDialog'>
          <h2 id='apex-import-confirm-title'>Importen har færre stasjoner</h2>
          <p>
            Skjemaet har {stations.length} stasjoner, mens importen inneholder {pendingApexImport.drafts.length}.
            Fortsetter du, fjernes {pendingApexImport.removedStationCount} stasjoner.
            {pendingApexImport.stationsWithDataCount} av dem inneholder manuelle verdier eller fiskeobservasjoner,
            og disse dataene går tapt.
          </p>
          <div class='importConfirmActions'>
            <button class='textButton' type='button' on:click={cancelPendingApexImport}>Avbryt import</button>
            <button class='confirmImportButton' type='button' on:click={confirmPendingApexImport}>
              Importer og fjern dataførte stasjoner
            </button>
          </div>
        </div>
      </Modal>
    {/if}

    <div class='pagePanelControls' role='group' aria-label='Visning av skjemainformasjon'>
      <button
        class='panelControlButton'
        type='button'
        aria-expanded={riverInfoExpanded}
        aria-controls='river-information-fields'
        on:click={() => { riverInfoExpanded = !riverInfoExpanded }}
      >{riverInfoExpanded ? 'Skjul elveinformasjon' : 'Vis elveinformasjon'}</button>
      <button
        class='panelControlButton'
        type='button'
        aria-expanded={allStationInfoExpanded}
        on:click={toggleAllStationInfo}
      >{allStationInfoExpanded ? 'Skjul alle stasjonsdata' : 'Vis alle stasjonsdata'}</button>
      <button
        class='panelControlButton'
        type='button'
        aria-expanded={allObservationsExpanded}
        on:click={toggleAllObservations}
      >{allObservationsExpanded ? 'Skjul alle fiskeobservasjoner' : 'Vis alle fiskeobservasjoner'}</button>
      <button
        class='panelControlButton'
        type='button'
        on:click={() => {
          stationMapError = ''
          stationMapMessage = ''
          stationMapPreviewOpen = true
        }}
      >Forhåndsvis stasjoner i kart</button>
    </div>

    <section class='formSection'>
      <div class='sectionHeading'>
        <span class='stepNumber'>1</span>
        <div>
          <h2>Elveinformasjon</h2>
          {#if riverInfoExpanded}
            <p>Fyll inn informasjon om elva, prosjektet og feltarbeidet.</p>
          {/if}
        </div>
      </div>
      <div id='river-information-fields'>
        {#if riverInfoExpanded}
          <div class='fieldGrid'>
            {#each riverFields as field (field.key)}
              <label class:wide={field.wide} class='field'>
                <span>{field.label}{#if field.required}<span class='requiredMark'> *</span>{/if}</span>
                {#if field.hint}<span class='fieldHint'>{field.hint}</span>{/if}
                {#if field.type === 'select'}
                  <select bind:value={riverData[field.key]} required={field.required}>
                    <option value=''>Velg</option>
                    {#each field.options as option}
                      <option value={option}>{option}</option>
                    {/each}
                  </select>
                {:else if field.type === 'textarea'}
                  <textarea bind:value={riverData[field.key]} rows='3'></textarea>
                {:else if field.type === 'commaDecimal'}
                  <input
                    type='text'
                    inputmode='decimal'
                    autocomplete='off'
                    spellcheck='false'
                    pattern='^-?\d*(,\d*)?$'
                    required={field.required}
                    value={riverData[field.key]}
                    on:keydown={preventDecimalPoint}
                    on:input={(event) => updateCommaDecimal(event, field.key)}
                  >
                {:else if field.type === 'date'}
                  <input
                    type='date'
                    required={field.required}
                    bind:value={riverData[field.key]}
                  >
                {:else if field.type === 'number'}
                  <input
                    type='number'
                    step={field.step}
                    required={field.required}
                    bind:value={riverData[field.key]}
                  >
                {:else}
                  <input
                    type='text'
                    required={field.required}
                    bind:value={riverData[field.key]}
                  >
                {/if}
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </section>

    <section class='formSection'>
      <div class='sectionHeading'>
        <span class='stepNumber'>2</span>
        <div>
          <h2>Stasjoner og fiskeobservasjoner</h2>
          <p>Legg til en stasjon for hvert transekt. Du kan knytte flere observasjoner til hver stasjon.</p>
        </div>
      </div>

      {#if stationMapMessage}
        <p class='stationMapStatus' role='status'>{stationMapMessage}</p>
      {/if}
      {#if stationMapError}
        <p class='stationMapError' role='alert'>{stationMapError}</p>
      {/if}
      {#if stationMapPreviewOpen}
        <StationMapPreview
          {stations}
          on:save={handleStationMapSave}
          on:close={() => { stationMapPreviewOpen = false }}
        />
      {/if}

      <div class='stationList'>
        {#each stations as station, stationIndex (station.key)}
          <article class='stationCard'>
            <div class='cardHeading'>
              <div>
                <h3>Stasjon {station.number || stationIndex + 1}</h3>
                {#if stationInfoExpandedByKey[station.key] !== false}
                  <p>Posisjon, forhold og innsats under fiske.</p>
                {/if}
              </div>
              <div class='stationHeadingActions'>
                <button
                  class='textButton collapseButton'
                  type='button'
                  aria-expanded={stationInfoExpandedByKey[station.key] !== false}
                  aria-controls={`station-fields-${station.key}`}
                  aria-label={`${stationInfoExpandedByKey[station.key] !== false ? 'Skjul' : 'Vis'} stasjonsinformasjon for Stasjon ${station.number || stationIndex + 1}`}
                  on:click={() => toggleStationInfo(station.key)}
                >{stationInfoExpandedByKey[station.key] !== false ? 'Skjul' : 'Vis'}</button>
                {#if stations.length > 1}
                  <button class='textButton removeButton' type='button' on:click={() => removeStation(station.key)}>Fjern stasjon</button>
                {/if}
              </div>
            </div>

            {#if stationInfoExpandedByKey[station.key] !== false}
              <div class='fieldGrid' id={`station-fields-${station.key}`}>
                {#each stationFields as field (field.key)}
                  <label class:wide={field.wide} class:missingField={isStationFieldMissing(station, field.key)} class='field'>
                    <span>{field.label}{#if field.required}<span class='requiredMark'> *</span>{/if}</span>
                    {#if field.hint}<span class='fieldHint'>{field.hint}</span>{/if}
                    {#if field.type === 'select'}
                      <select bind:value={station[field.key]} required={field.required}>
                        <option value=''>Velg</option>
                        {#each field.options as option}
                          <option value={option}>{option}</option>
                        {/each}
                      </select>
                    {:else if field.type === 'textarea'}
                      <textarea bind:value={station[field.key]} rows='3' required={field.required}></textarea>
                    {:else if field.type === 'commaDecimal'}
                      <input
                        type='text'
                        inputmode='decimal'
                        autocomplete='off'
                        spellcheck='false'
                        pattern='^-?\d*(,\d*)?$'
                        required={field.required}
                        value={station[field.key] ?? ''}
                        on:keydown={preventDecimalPoint}
                        on:input={(event) => updateCommaDecimal(event, field.key, station.key)}
                      >
                    {:else if field.type === 'date'}
                      <input
                        type='date'
                        required={field.required}
                        bind:value={station[field.key]}
                      >
                    {:else if field.type === 'time24'}
                      <div class='timePicker'>
                        <select
                          aria-label={`Klokkeslett start, time for stasjon ${station.number}`}
                          required={field.required}
                          value={station.startHour}
                          on:change={(event) => updateTimePart(station.key, 'startHour', event.currentTarget.value)}
                        >
                          <option value=''>TT</option>
                          {#each hourOptions as hour}
                            <option value={hour}>{hour}</option>
                          {/each}
                        </select>
                        <span>:</span>
                        <select
                          aria-label={`Klokkeslett start, minutt for stasjon ${station.number}`}
                          required={field.required}
                          value={station.startMinute}
                          on:change={(event) => updateTimePart(station.key, 'startMinute', event.currentTarget.value)}
                        >
                          <option value=''>MM</option>
                          {#each minuteOptions as minute}
                            <option value={minute}>{minute}</option>
                          {/each}
                        </select>
                      </div>
                    {:else if field.type === 'number'}
                      <input
                        type='number'
                        step={field.step}
                        min={field.min}
                        required={field.required}
                        bind:value={station[field.key]}
                      >
                    {:else}
                      <input
                        type='text'
                        required={field.required}
                        bind:value={station[field.key]}
                      >
                    {/if}
                  </label>
                {/each}
              </div>
            {/if}

            <div class='observations'>
              <div class='observationHeading'>
                <div>
                  <h4>Fiskeobservasjoner for Stasjon {station.number || stationIndex + 1}</h4>
                  {#if observationsExpandedByStationKey[station.key] !== false}
                    <p>ID er automatisk og numerisk. Referansen viser stasjon og fiskenummer, for eksempel 1-11.</p>
                    <p>Dra det lille håndtaket nederst i en celle nedover for å kopiere verdien.</p>
                  {/if}
                </div>
                <button
                  class='textButton collapseButton'
                  type='button'
                  aria-expanded={observationsExpandedByStationKey[station.key] !== false}
                  aria-controls={`station-observations-${station.key}`}
                  aria-label={`${observationsExpandedByStationKey[station.key] !== false ? 'Skjul' : 'Vis'} fiskeobservasjoner for Stasjon ${station.number || stationIndex + 1}`}
                  on:click={() => toggleObservations(station.key)}
                >{observationsExpandedByStationKey[station.key] !== false ? 'Skjul' : 'Vis'}</button>
              </div>

              {#if observationsExpandedByStationKey[station.key] !== false}
                <div id={`station-observations-${station.key}`}>
                  <div class='observationTableWrap'>
                <table class='observationTable'>
                  <colgroup>
                    <col class='idColumn'>
                    <col class='referenceColumn'>
                    <col class='roundColumn'>
                    <col class='speciesColumn'>
                    <col class='lengthColumn'>
                    <col class='countColumn'>
                    <col class='genderColumn'>
                    <col class='ageColumn'>
                    <col class='releasedColumn'>
                    <col class='sampledColumn'>
                    <col class='commentColumn'>
                    <col class='actionColumn'>
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope='col'>ID</th>
                      <th scope='col'>Stasjonsreferanse</th>
                      {#each observationFields as field (field.key)}
                        <th scope='col'>{field.label}{#if field.required}<span class='requiredMark'> *</span>{/if}</th>
                      {/each}
                      <th scope='col'>Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each station.observations as observation, observationIndex (observation.key)}
                      <tr
                        class:fillTargetRow={fillTarget === observation.key && fillSource?.stationKey === station.key}
                        on:pointerenter={() => updateFillTarget(station.key, observation.key)}
                      >
                        <td class='generatedId'>{observation.id ?? ''}</td>
                        <td class='generatedReference'>{observationReference(station, observationIndex)}</td>
                        {#each observationFields as field (field.key)}
                          <td>
                            {#if fillableObservationFields.has(field.key)}
                              <div class='fillCell' class:speciesPickerOpen={activeSpeciesObservationKey === observation.key}>
                                {#if field.key === 'species'}
                                  <input
                                    type='text'
                                    role='combobox'
                                    aria-label={`Art for rad ${observationIndex + 1}`}
                                    aria-autocomplete='list'
                                    aria-expanded={activeSpeciesObservationKey === observation.key}
                                    aria-controls={`species-options-${observation.key}`}
                                    aria-activedescendant={highlightedSpeciesIndex >= 0 ? `species-option-${observation.key}-${highlightedSpeciesIndex}` : undefined}
                                    placeholder='Søk eller velg art'
                                    autocomplete='off'
                                    required={field.required && observationHasData(observation)}
                                    value={activeSpeciesObservationKey === observation.key ? speciesSearchQuery : observation.species}
                                    on:focus={(event) => openSpeciesOptions(observation.key, observation.species, event)}
                                    on:input={updateSpeciesSearch}
                                    on:keydown={(event) => handleSpeciesKeydown(event, station.key, observation.key)}
                                    on:blur={closeSpeciesOptions}
                                  >
                                  {#if activeSpeciesObservationKey === observation.key}
                                    <div
                                      id={`species-options-${observation.key}`}
                                      class='speciesOptions'
                                      role='listbox'
                                      aria-label='Velg fiskeart'
                                    >
                                      {#each filteredFreshwaterFish as species, speciesIndex (species.label)}
                                        <button
                                          id={`species-option-${observation.key}-${speciesIndex}`}
                                          class='speciesOption'
                                          type='button'
                                          role='option'
                                          aria-selected={highlightedSpeciesIndex === speciesIndex}
                                          on:pointerdown={(event) => event.preventDefault()}
                                          on:click={() => selectSpecies(station.key, observation.key, species)}
                                        >{species.label}</button>
                                      {:else}
                                        <span class='speciesNoResults'>Ingen treff. Velg en art fra listen.</span>
                                      {/each}
                                    </div>
                                  {/if}
                                {:else if field.type === 'select'}
                                  <select
                                    aria-label={`${field.label} for rad ${observationIndex + 1}`}
                                    value={observation[field.key]}
                                    on:change={(event) => updateObservation(station.key, observation.key, field.key, event.currentTarget.value)}
                                  >
                                    <option value=''>Velg</option>
                                    {#each field.options as option}
                                      <option value={option}>{option}</option>
                                    {/each}
                                  </select>
                                {:else}
                                  <input
                                    type={field.type}
                                    step={field.step}
                                    min={field.min}
                                    aria-label={`${field.label} for rad ${observationIndex + 1}`}
                                    value={observation[field.key]}
                                    on:input={(event) => updateObservation(station.key, observation.key, field.key, event.currentTarget.value)}
                                  >
                                {/if}
                                <button
                                  class='fillHandle'
                                  type='button'
                                  title={`Dra ned for å kopiere ${field.label}`}
                                  aria-label={`Dra ned for å fylle ${field.label} fra rad ${observationIndex + 1}`}
                                  on:pointerdown={(event) => startFill(station.key, observation.key, field.key, event)}
                                ></button>
                              </div>
                            {:else if field.type === 'select'}
                              <select
                                aria-label={`${field.label} for rad ${observationIndex + 1}`}
                                value={observation[field.key]}
                                on:change={(event) => updateObservation(station.key, observation.key, field.key, event.currentTarget.value)}
                              >
                                <option value=''>Velg</option>
                                {#each field.options as option}
                                  <option value={option}>{option}</option>
                                {/each}
                              </select>
                            {:else}
                              <input
                                type={field.type}
                                step={field.step}
                                min={field.min}
                                aria-label={`${field.label} for rad ${observationIndex + 1}`}
                                value={observation[field.key]}
                                required={field.required && observationHasData(observation)}
                                on:input={(event) => updateObservation(station.key, observation.key, field.key, event.currentTarget.value)}
                              >
                            {/if}
                          </td>
                        {/each}
                        <td>
                          <button
                            class='textButton removeButton rowRemoveButton'
                            type='button'
                            aria-label={`Fjern rad ${observationIndex + 1} fra stasjon ${station.number}`}
                            on:click={() => removeObservation(station.key, observation.key)}
                          >Fjern</button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
                  </div>

                  <div class='rowActions'>
                    <span>{station.observations.length} rader</span>
                    <div>
                      <button class='textButton' type='button' on:click={() => addObservationRows(station.key, 1)}>+ Legg til 1 rad</button>
                      <button class='textButton' type='button' on:click={() => addObservationRows(station.key, 10)}>+ Legg til 10 rader</button>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </article>
        {/each}
      </div>

      <button class='addStationButton' type='button' on:click={addStation}>+ Legg til stasjon</button>
    </section>

    <footer class='formFooter'>
      <div class='formFooterCopy'>
        <p>Du kan også bruke Excel-arbeidsflyten fra <a href='/upload'>Last opp</a>.</p>
        <p id='publish-disabled-note'>Publisering til server og database er ikke koblet til ennå.</p>
      </div>
      <div class='formFooterActions'>
        <Button type='blue' href='/upload' size='small'>Gå til Last opp</Button>
        <button
          class='publishButton'
          type='button'
          disabled
          aria-describedby='publish-disabled-note'
          title='Publisering må kobles til backend før knappen kan brukes'
        >Publiser data</button>
      </div>
    </footer>
  </div>
</main>

<style>
  .manualEntryPage {
    min-height: calc(100vh - var(--header-height));
    background: #f4f6f8;
    padding: 2rem 1rem 4rem;
  }

  .pageContent {
    width: min(1360px, 100%);
    margin: 0 auto;
  }

  .pageIntro {
    margin: 0 0 1.5rem;
  }

  .eyebrow {
    margin: 0 0 0.5rem;
    color: var(--SCOLOR);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  h1 {
    margin: 0;
    color: var(--PCOLOR);
    font-size: clamp(2rem, 4vw, 2.8rem);
  }

  .pageIntro > p:last-child {
    max-width: 760px;
    line-height: 1.6;
  }

  .pageIntro a,
  .formFooter a {
    color: var(--PCOLOR);
    font-weight: 700;
  }

  .formNotice {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    margin-bottom: 1.25rem;
    padding: 1rem 1.25rem;
    border-left: 4px solid var(--SCOLOR);
    border-radius: 0.5rem;
    background: #fff7f3;
    line-height: 1.5;
  }

  .formNotice strong {
    white-space: nowrap;
  }

  .apexImportMessage,
  .apexImportError {
    margin: -0.5rem 0 1.25rem;
    padding: 0.85rem 1rem;
    border-left: 4px solid var(--PCOLOR);
    border-radius: 0.35rem;
    background: #edf5f0;
    line-height: 1.5;
  }

  .apexImportError {
    border-left-color: #9d2d20;
    background: #fff1ef;
  }

  .importConfirmDialog {
    width: 100%;
    padding: 1.5rem 1rem;
  }

  .importConfirmActions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .confirmImportButton {
    padding: 0.65rem 1rem;
    border: 0;
    border-radius: 0.35rem;
    background: #9d2d20;
    color: white;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }

  .formSection,
  .stationCard {
    margin-bottom: 1.5rem;
    padding: clamp(1rem, 3vw, 2rem);
    border: 1px solid #e2e7eb;
    border-radius: 0.75rem;
    background: white;
    box-shadow: 0 2px 8px rgb(35 55 70 / 6%);
  }

  .sectionHeading,
  .cardHeading,
  .observationHeading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .sectionHeading {
    justify-content: flex-start;
    margin-bottom: 1.5rem;
  }

  .pagePanelControls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
    margin: 0 0 1.25rem;
  }

  .panelControlButton {
    flex: 1 1 190px;
    min-height: 2.8rem;
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--PCOLOR);
    border-radius: 0.4rem;
    background: white;
    color: var(--PCOLOR);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }

  .panelControlButton:hover {
    background: #edf1f4;
  }

  .stationMapStatus,
  .stationMapError {
    margin: -0.5rem 0 1rem;
    padding: 0.75rem 1rem;
    border-left: 4px solid var(--PCOLOR);
    border-radius: 0.35rem;
    background: #edf5f0;
    line-height: 1.45;
  }

  .stationMapError {
    border-left-color: #9d2d20;
    background: #fff1ef;
  }

  .stepNumber {
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    flex: 0 0 2.25rem;
    place-items: center;
    border-radius: 50%;
    background: var(--PCOLOR);
    color: white;
    font-weight: 700;
  }

  h2,
  h3,
  h4 {
    margin: 0;
    color: var(--PCOLOR);
  }

  .sectionHeading p,
  .cardHeading p,
  .observationHeading p {
    margin: 0.35rem 0 0;
    color: #5d6870;
    line-height: 1.45;
  }

  .fieldGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .field {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.4rem;
    color: #27343d;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .fieldHint {
    margin-top: -0.2rem;
    color: #5d6870;
    font-size: 0.8rem;
    font-weight: 400;
  }

  .field.missingField input,
  .field.missingField select,
  .field.missingField textarea {
    border-color: #d98e88;
    background: #fff0ef;
  }

  .timePicker {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .timePicker select {
    width: 5rem;
  }

  .field.wide {
    grid-column: 1 / -1;
  }

  .field input,
  .field select,
  .field textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 2.75rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid #b9c3ca;
    border-radius: 0.4rem;
    background: white;
    color: #1d2b34;
    font: inherit;
    font-weight: 400;
  }

  .field textarea {
    min-height: 5rem;
    resize: vertical;
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: var(--PCOLOR);
    outline: 2px solid rgb(67 87 104 / 20%);
  }

  .requiredMark {
    color: #c2371c;
  }

  .stationList {
    display: grid;
    gap: 1rem;
  }

  .stationCard {
    margin: 0;
    padding: clamp(1rem, 2.5vw, 1.5rem);
    border-top: 4px solid var(--PCOLOR);
    box-shadow: none;
  }

  .cardHeading {
    align-items: center;
    margin-bottom: 1.25rem;
  }

  .stationHeadingActions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.35rem;
  }

  .textButton {
    padding: 0.5rem 0.65rem;
    border: 0;
    border-radius: 0.35rem;
    background: transparent;
    color: var(--PCOLOR);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }

  .textButton:hover {
    background: #edf1f4;
  }

  .collapseButton {
    flex: 0 0 auto;
    margin-left: auto;
  }

  .removeButton {
    color: #9d2d20;
  }

  .observations {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid #e2e7eb;
  }

  .observationHeading {
    align-items: center;
    margin-bottom: 1rem;
  }

  .observationHeading > div {
    min-width: 0;
  }

  .observationHeading .collapseButton {
    align-self: flex-start;
  }

  .observationTableWrap {
    width: 100%;
    max-height: 34rem;
    margin: 0 auto;
    overflow: auto;
    border: 1px solid #dce3e8;
    border-radius: 0.5rem;
  }

  .observationTable {
    width: 100%;
    min-width: 980px;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    font-size: 0.82rem;
  }

  .idColumn { width: 4%; }
  .referenceColumn { width: 8%; }
  .roundColumn { width: 6%; }
  .speciesColumn { width: 10%; }
  .lengthColumn { width: 6%; }
  .countColumn { width: 6%; }
  .genderColumn { width: 7%; }
  .ageColumn { width: 5%; }
  .releasedColumn { width: 10%; }
  .sampledColumn { width: 10%; }
  .commentColumn { width: 18%; }
  .actionColumn { width: 10%; }

  .observationTable th:nth-child(2) {
    position: sticky;
    left: 4%;
    z-index: 3;
  }

  .observationTable th,
  .observationTable td {
    box-sizing: border-box;
    overflow-wrap: anywhere;
    padding: 0.35rem 0.25rem;
    border-right: 1px solid #e2e7eb;
    border-bottom: 1px solid #e2e7eb;
    text-align: left;
  }

  .observationTable th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #edf1f4;
    color: var(--PCOLOR);
    font-size: 0.78rem;
    font-weight: 700;
  }

  .observationTable th:first-child,
  .observationTable td:first-child {
    position: sticky;
    left: 0;
    z-index: 2;
    background: #f8fafb;
  }

  .observationTable th:first-child {
    z-index: 3;
    background: #edf1f4;
  }

  .observationTable input,
  .observationTable select {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 2.25rem;
    padding: 0.3rem;
    border: 1px solid #b9c3ca;
    border-radius: 0.3rem;
    background: white;
    font: inherit;
  }

  .observationTable td:first-child {
    min-width: 2.5rem;
    text-align: center;
  }

  .observationTable td:nth-child(2) {
    position: sticky;
    left: 4%;
    z-index: 2;
    background: #f8fafb;
  }

  .observationTable tbody tr.fillTargetRow td,
  .observationTable tbody tr.fillTargetRow td:first-child,
  .observationTable tbody tr.fillTargetRow td:nth-child(2) {
    background: #fff2d8;
  }

  .fillCell {
    position: relative;
    width: 100%;
  }

  .fillCell.speciesPickerOpen {
    z-index: 10;
  }

  .fillCell input {
    padding-right: 0.9rem;
  }

  .speciesOptions {
    position: absolute;
    top: calc(100% + 0.2rem);
    left: 0;
    z-index: 10;
    width: max(18rem, 100%);
    max-height: 16rem;
    overflow-y: auto;
    border: 1px solid #b9c3ca;
    border-radius: 0.4rem;
    background: white;
    box-shadow: 0 4px 12px rgb(35 55 70 / 16%);
  }

  .speciesOption {
    display: block;
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: 0;
    background: white;
    color: #1d2b34;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .speciesOption:hover,
  .speciesOption[aria-selected='true'] {
    background: #edf1f4;
    color: var(--PCOLOR);
  }

  .speciesNoResults {
    display: block;
    padding: 0.6rem;
    color: #5d6870;
  }

  .fillHandle {
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 0.65rem;
    height: 0.65rem;
    padding: 0;
    border: 1px solid white;
    border-radius: 2px;
    background: var(--SCOLOR);
    cursor: ns-resize;
    touch-action: none;
  }

  .fillHandle:hover,
  .fillHandle:focus-visible {
    outline: 2px solid var(--PCOLOR);
    outline-offset: 1px;
  }

  .generatedId {
    color: #596771;
    font-variant-numeric: tabular-nums;
  }

  .generatedReference {
    color: var(--PCOLOR);
    font-weight: 700;
  }

  .rowActions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.65rem;
    color: #5d6870;
    font-size: 0.9rem;
  }

  .rowActions > div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .rowRemoveButton {
    font-size: 0.85rem;
  }

  .addStationButton {
    width: 100%;
    min-height: 3rem;
    border: 2px dashed #83929d;
    border-radius: 0.55rem;
    background: transparent;
    color: var(--PCOLOR);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }

  .addStationButton:hover {
    border-color: var(--PCOLOR);
    background: white;
  }

  .formFooter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0;
  }

  .formFooterCopy p {
    margin: 0.3rem 0;
  }

  .formFooterActions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .publishButton {
    min-height: 2.75rem;
    padding: 0.65rem 1.1rem;
    border: 1px solid #9fc9a5;
    border-radius: 0.45rem;
    background: #e2f1e4;
    color: #285d32;
    cursor: not-allowed;
    font: inherit;
    font-weight: 700;
  }

  @media (max-width: 650px) {
    .manualEntryPage {
      padding: 1.25rem 0.75rem 3rem;
    }

    .formNotice {
      flex-direction: column;
      gap: 0.25rem;
    }

    .sectionHeading {
      flex-wrap: wrap;
    }

    .fieldGrid {
      grid-template-columns: 1fr;
    }

    .field.wide {
      grid-column: auto;
    }

    .formFooter {
      align-items: flex-start;
      flex-direction: column;
    }

    .observationHeading,
    .rowActions {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
