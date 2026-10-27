const COORDINATE_PATTERN = /^-?\d+(?:,\d+)?$/
const EDITABLE_FIELDS = [
  'number',
  'startTime',
  'startLat',
  'startLong',
  'endLat',
  'endLong',
  'transectLength',
  'secondsFished'
]

/**
 * Load Leaflet only in the browser to keep server-side rendering safe.
 * @returns {Promise<{leaflet: object, mapLayers: object}>} Browser map resources
 */
export async function loadStationMapResources () {
  const [leafletModule, layersModule] = await Promise.all([
    import('leaflet'),
    import('../constants/leafletLayers.js')
  ])

  return {
    leaflet: leafletModule.default,
    mapLayers: layersModule.mapLayers
  }
}

/**
 * Create an isolated editable copy of the station fields used by the map.
 * @param {object[]} stations - Current add-data station models
 * @returns {object[]} Editable map station models
 */
export function createStationMapDrafts (stations) {
  if (!Array.isArray(stations)) {
    throw new TypeError('Stasjonene må være en liste.')
  }

  return stations.map(station => ({
    key: station.key,
    number: String(station.number ?? ''),
    startTime: String(station.startTime ?? ''),
    startLat: String(station.startLat ?? ''),
    startLong: String(station.startLong ?? ''),
    endLat: String(station.endLat ?? ''),
    endLong: String(station.endLong ?? ''),
    transectLength: String(station.transectLength ?? ''),
    secondsFished: String(station.secondsFished ?? '')
  }))
}

/**
 * Create a stable snapshot of the fields that can be changed in map preview.
 * @param {object[]} stations - Station map drafts
 * @returns {string} Snapshot
 */
export function getStationMapSnapshot (stations) {
  return JSON.stringify(stations.map(station => ({
    key: station.key,
    ...Object.fromEntries(EDITABLE_FIELDS.map(field => [field, station[field]]))
  })))
}

/**
 * Parse a comma-decimal coordinate value used by the add-data form.
 * @param {string} value - Coordinate input
 * @returns {number|null} Finite coordinate or null if incomplete/empty
 */
export function parseMapCoordinate (value) {
  const normalized = String(value ?? '').trim()
  if (!normalized || !COORDINATE_PATTERN.test(normalized)) return null

  const coordinate = Number(normalized.replace(',', '.'))
  return Number.isFinite(coordinate) ? coordinate : null
}

/**
 * Check whether one latitude/longitude pair can be shown on the map.
 * @param {string} latitude - Latitude input
 * @param {string} longitude - Longitude input
 * @returns {boolean} Whether the pair is complete and in range
 */
export function isValidMapPosition (latitude, longitude) {
  return parseMapPosition(latitude, longitude) !== null
}

/**
 * Parse a valid latitude/longitude pair for Leaflet.
 * @param {string} latitude - Latitude input
 * @param {string} longitude - Longitude input
 * @returns {[number, number]|null} Leaflet position or null when invalid
 */
export function parseMapPosition (latitude, longitude) {
  const lat = parseMapCoordinate(latitude)
  const lon = parseMapCoordinate(longitude)
  return lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
    ? [lat, lon]
    : null
}

/**
 * Convert a Leaflet coordinate to the comma-decimal format used by the form.
 * @param {number} value - Coordinate from the map
 * @returns {string} Coordinate input value
 */
export function formatMapCoordinate (value) {
  return Number(value.toFixed(6)).toString().replace('.', ',')
}

/**
 * Validate station numbers and non-empty coordinate inputs before saving.
 * @param {object[]} stations - Current station map drafts
 * @returns {string[]} User-readable validation errors
 */
export function validateStationMapDrafts (stations) {
  const errors = []
  const numbers = new Map()

  stations.forEach((station, index) => {
    const label = `Stasjon ${station.number || index + 1}`
    const normalizedNumber = Number(station.number)

    if (!Number.isInteger(normalizedNumber) || normalizedNumber < 1) {
      errors.push(`${label}: stasjonsnummer må være et positivt heltall.`)
    } else {
      numbers.set(normalizedNumber, (numbers.get(normalizedNumber) || 0) + 1)
    }

    const startTime = String(station.startTime ?? '').trim()
    if (startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      errors.push(`${label}: klokkeslett må være gyldig i 24-timers format.`)
    }

    for (const [field, axis, min, max] of [
      ['startLat', 'startbreddegrad', -90, 90],
      ['startLong', 'startlengdegrad', -180, 180],
      ['endLat', 'stoppbreddegrad', -90, 90],
      ['endLong', 'stopplengdegrad', -180, 180]
    ]) {
      const value = String(station[field] ?? '').trim()
      if (!value) continue

      const coordinate = parseMapCoordinate(value)
      if (coordinate === null || coordinate < min || coordinate > max) {
        errors.push(`${label}: ${axis} må være et gyldig desimaltall med komma.`)
      }
    }

    for (const [field, labelText] of [
      ['transectLength', 'transektlengde'],
      ['secondsFished', 'sekunder fisket']
    ]) {
      const value = String(station[field] ?? '').trim()
      if (value && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        errors.push(`${label}: ${labelText} må være et tall større enn eller lik null.`)
      }
    }
  })

  for (const [number, count] of numbers) {
    if (count > 1) errors.push(`Stasjonsnummer ${number} er brukt flere ganger.`)
  }

  return errors
}
