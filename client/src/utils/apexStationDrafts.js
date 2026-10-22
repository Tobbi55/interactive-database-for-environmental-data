import { ApexImportError } from './apexImport.js'

const ACTIVE_STATUSES = new Set(['p', 'pa', 'ps'])
const EARTH_RADIUS_METERS = 6371000
const APEX_MAPPED_STATION_FIELDS = [
  'number',
  'date',
  'startTime',
  'startLat',
  'startLong',
  'endLat',
  'endLong',
  'transectLength',
  'secondsFished',
  'voltage',
  'pulse',
  'display'
]

/**
 * Merge APEX-mapped values into an editable add-data station.
 * @param {object} station - Existing station form model
 * @param {object} draft - APEX station draft
 * @returns {object} Updated station with its manual fields preserved
 */
export function mergeApexStationDraft (station, draft) {
  if (!station || typeof station !== 'object' || !draft || typeof draft !== 'object') {
    throw new TypeError('APEX-stasjon og stasjonsutkast må være objekter.')
  }

  const timeParts = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(draft.startTime || '')
  if (!timeParts) {
    throw new ApexImportError('APEX-utkastet inneholder ugyldig starttid.')
  }

  const mappedValues = Object.fromEntries(
    APEX_MAPPED_STATION_FIELDS.map(field => [field, draft[field]])
  )

  return {
    ...station,
    ...mappedValues,
    boatType: String(station.boatType ?? '').trim() ? station.boatType : 'Cataraft',
    startHour: timeParts[1],
    startMinute: timeParts[2]
  }
}

/**
 * Format a numeric form value with the comma decimal separator used by the station form.
 * @param {number} value - Numeric value
 * @param {number} precision - Maximum decimal precision
 * @returns {string} Formatted value
 */
function formatFormNumber (value, precision = 6) {
  return String(Number(value.toFixed(precision))).replace('.', ',')
}

/**
 * Read local date and time components from the original logger timestamp.
 * @param {string} timestamp - APEX timestamp with an optional timezone
 * @param {number} stationNumber - Station number for error context
 * @returns {{date: string, startTime: string}} Local date and time
 */
function getLocalDateAndTime (timestamp, stationNumber) {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.exec(timestamp)
  if (!match) {
    throw new ApexImportError(`Ugyldig startdato eller starttid for stasjon ${stationNumber}.`)
  }

  return {
    date: match[1],
    startTime: `${match[2]}:${match[3]}`
  }
}

/**
 * Return whether a trends row has a valid GPS position.
 * @param {object} row - Parsed trends row
 * @returns {boolean} Whether both coordinates are valid
 */
function hasValidCoordinates (row) {
  return Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
}

/**
 * Parse nominal voltage and pulse frequency from an APEX waveform string.
 * @param {string} waveform - APEX waveform description
 * @returns {{voltage: number|null, pulse: number|null}} Parsed waveform values
 */
function parseWaveform (waveform) {
  const voltageMatch = /(\d+(?:[.,]\d+)?)\s*V(?:AC|DC)?\b/i.exec(waveform)
  const pulseMatch = /(\d+(?:[.,]\d+)?)\s*Hz\b/i.exec(waveform)

  return {
    voltage: voltageMatch ? Number(voltageMatch[1].replace(',', '.')) : null,
    pulse: pulseMatch ? Number(pulseMatch[1].replace(',', '.')) : null
  }
}

/**
 * Select the unique most common value and report mixed or ambiguous values.
 * @param {(number|null)[]} values - Values from active rows
 * @param {number} stationNumber - Station number
 * @param {string} field - Form field name
 * @param {string} label - User-facing field name
 * @param {object[]} warnings - Warning list to append to
 * @returns {number|null} Most common value, or null when ambiguous/unavailable
 */
function mostCommonValue (values, stationNumber, field, label, warnings) {
  const counts = new Map()
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1))

  if (counts.size === 0) {
    warnings.push({
      stationNumber,
      field,
      message: `Fant ingen aktiv verdi for ${label} i stasjon ${stationNumber}; fyll inn manuelt.`
    })
    return null
  }

  const mostCommonCount = Math.max(...counts.values())
  const mostCommonValues = [...counts.entries()]
    .filter(([, count]) => count === mostCommonCount)
    .map(([value]) => value)

  if (counts.size > 1) {
    warnings.push({
      stationNumber,
      field,
      message: `Verdien for ${label} varierer i stasjon ${stationNumber}; vanligste verdi er brukt der den er entydig.`
    })
  }

  if (mostCommonValues.length !== 1 || mostCommonValues[0] === null) {
    if (mostCommonValues.length > 1 || mostCommonValues[0] === null) {
      warnings.push({
        stationNumber,
        field,
        message: `Kunne ikke velge en entydig verdi for ${label} i stasjon ${stationNumber}; fyll inn manuelt.`
      })
    }
    return null
  }

  return mostCommonValues[0]
}

/**
 * Calculate great-circle distance between two latitude/longitude positions.
 * @param {number[]} start - Start coordinate as [latitude, longitude]
 * @param {number[]} end - End coordinate as [latitude, longitude]
 * @returns {number} Distance in meters
 */
function distanceBetweenCoordinates (start, end) {
  const lat1 = start[0] * Math.PI / 180
  const lat2 = end[0] * Math.PI / 180
  const dLat = (end[0] - start[0]) * Math.PI / 180
  const dLon = (end[1] - start[1]) * Math.PI / 180
  const haversine = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(1 - haversine)
  )
}

/**
 * Estimate the path length from consecutive valid GPS points.
 * @param {object[]} rows - Trends rows in sequence order
 * @returns {number|null} Rounded path length in meters, or null with fewer than two points
 */
function estimatePathLength (rows) {
  const coordinates = rows
    .filter(hasValidCoordinates)
    .map(row => [row.latitude, row.longitude])

  if (coordinates.length < 2) return null

  const distance = coordinates.slice(1).reduce(
    (total, coordinate, index) => total + distanceBetweenCoordinates(coordinates[index], coordinate),
    0
  )

  return Math.round(distance)
}

/**
 * Estimate the straight-line transect length between its editable endpoints.
 * @param {object} station - Station coordinates in comma-decimal form
 * @returns {number|null} Rounded length in meters, or null when an endpoint is invalid
 */
export function estimateEditedTransectLength (station) {
  const parseCoordinate = value => {
    const normalized = String(value ?? '').trim().replace(',', '.')
    if (!normalized) return null
    const coordinate = Number(normalized)
    return Number.isFinite(coordinate) ? coordinate : null
  }
  const start = [parseCoordinate(station.startLat), parseCoordinate(station.startLong)]
  const end = [parseCoordinate(station.endLat), parseCoordinate(station.endLong)]

  if (start.some(value => value === null) ||
    end.some(value => value === null) ||
    start[0] < -90 || start[0] > 90 || end[0] < -90 || end[0] > 90 ||
    start[1] < -180 || start[1] > 180 || end[1] < -180 || end[1] > 180) {
    return null
  }

  return Math.round(distanceBetweenCoordinates(start, end))
}

/**
 * Build editable add-data station values from segmented APEX trends rows.
 * The result intentionally excludes manually entered fields and fish observations.
 * @param {object[][]} groups - Trends rows grouped by station timer sequence
 * @returns {{stations: object[], warnings: object[]}} Station drafts and field warnings
 */
export function createApexStationDrafts (groups) {
  if (!Array.isArray(groups)) {
    throw new TypeError('APEX-sekvenser må være en array.')
  }

  const stations = []
  const warnings = []

  groups.forEach((rows, groupIndex) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ApexImportError(`APEX-sekvens ${groupIndex + 1} er tom eller ugyldig.`)
    }

    const stationNumber = stations.length + 1
    const { date, startTime } = getLocalDateAndTime(rows[0].date, stationNumber)
    const maxTimer = Math.max(...rows.map(row => row.timer))
    const activeRows = rows.filter(row => ACTIVE_STATUSES.has(row.status.toLowerCase()))
    const startAtTimerFive = rows.find(row => row.timer === 5 && hasValidCoordinates(row))
    const startFallback = rows.find(row => row.timer >= 5 && hasValidCoordinates(row))
    const startPosition = startAtTimerFive || startFallback
    const endPosition = [...rows].reverse().find(row => row.timer === maxTimer && hasValidCoordinates(row))

    if (!startAtTimerFive && startFallback) {
      warnings.push({
        stationNumber,
        field: 'startLat',
        message: `Stasjon ${stationNumber} mangler GPS ved timer 5; første gyldige punkt fra timer ${startFallback.timer} er brukt.`
      })
    } else if (!startPosition) {
      warnings.push({
        stationNumber,
        field: 'startLat',
        message: `Fant ikke et gyldig startpunkt ved eller etter timer 5 for stasjon ${stationNumber}; fyll inn manuelt.`
      })
    }

    if (!endPosition) {
      warnings.push({
        stationNumber,
        field: 'endLat',
        message: `Fant ikke gyldig GPS ved høyeste timerverdi for stasjon ${stationNumber}; fyll inn manuelt.`
      })
    }

    const parsedWaveforms = activeRows.map(row => parseWaveform(row.waveform))
    const voltage = mostCommonValue(
      parsedWaveforms.map(value => value.voltage),
      stationNumber,
      'voltage',
      'Volt',
      warnings
    )
    const pulse = mostCommonValue(
      parsedWaveforms.map(value => value.pulse),
      stationNumber,
      'pulse',
      'Puls (DC)',
      warnings
    )

    const currentValues = activeRows
      .map(row => row.averageCurrent)
      .filter(Number.isFinite)
    if (currentValues.length < activeRows.length) {
      warnings.push({
        stationNumber,
        field: 'display',
        message: `En eller flere Average Current-verdier mangler i stasjon ${stationNumber}; gjennomsnittet bruker tilgjengelige målinger.`
      })
    }
    if (currentValues.length === 0) {
      warnings.push({
        stationNumber,
        field: 'display',
        message: `Fant ingen aktiv Average Current-verdi i stasjon ${stationNumber}; fyll inn manuelt.`
      })
    }

    const averageCurrent = currentValues.length > 0
      ? Number((currentValues.reduce((sum, value) => sum + value, 0) / currentValues.length).toFixed(2))
      : null
    const pathLength = estimatePathLength(rows)
    if (pathLength === null) {
      warnings.push({
        stationNumber,
        field: 'transectLength',
        message: `Transektlengde kunne ikke estimeres med færre enn to gyldige GPS-punkter i stasjon ${stationNumber}.`
      })
    }
    const hasValidEndpoints = Boolean(startPosition && endPosition)
    if (!hasValidEndpoints && pathLength !== null) {
      warnings.push({
        stationNumber,
        field: 'transectLength',
        message: `Transektlengde er fjernet fordi stasjon ${stationNumber} mangler gyldige start- eller stoppkoordinater.`
      })
    }

    stations.push({
      number: String(stationNumber),
      date,
      startTime,
      startLat: startPosition ? formatFormNumber(startPosition.latitude) : '',
      startLong: startPosition ? formatFormNumber(startPosition.longitude) : '',
      endLat: endPosition ? formatFormNumber(endPosition.latitude) : '',
      endLong: endPosition ? formatFormNumber(endPosition.longitude) : '',
      transectLength: pathLength === null || !hasValidEndpoints ? '' : String(pathLength),
      secondsFished: String(maxTimer),
      voltage: voltage === null ? '' : String(voltage),
      pulse: pulse === null ? '' : String(pulse),
      display: averageCurrent === null ? '' : formatFormNumber(averageCurrent, 2)
    })
  })

  return { stations, warnings }
}
