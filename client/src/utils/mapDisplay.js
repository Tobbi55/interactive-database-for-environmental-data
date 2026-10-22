const DEFAULT_STATION_COLOR = '#ff3333'
const GOLDEN_ANGLE = 137.508

export const STATION_MARKER_STYLE = {
  radius: 6,
  fillColor: DEFAULT_STATION_COLOR,
  color: '#cc0000',
  weight: 2,
  opacity: 0.9,
  fillOpacity: 0.8
}

export const RIVER_MARKER_STYLE = {
  radius: 12,
  fillColor: '#3366ff',
  color: '#0033cc',
  weight: 2,
  opacity: 0.9,
  fillOpacity: 0.8
}

export const SELECTED_MARKER_STYLE = {
  radius: 12,
  fillColor: '#ff9933',
  color: '#ff6600',
  weight: 2,
  opacity: 0.9,
  fillOpacity: 0.8
}

/**
 * Get a stable color for a station or its associated river record.
 * @param {object} station - Station with river and station identifiers
 * @param {boolean} separateByRiver - Whether to color stations by river record
 * @param {Map<number, {id: number, name: string}>} stationRivers - Station-to-river relationships
 * @returns {{fillColor: string, color: string}} Leaflet circle style colors
 */
export function getStationMapColors (station, separateByRiver, stationRivers = null) {
  if (!separateByRiver) {
    return {
      fillColor: DEFAULT_STATION_COLOR,
      color: '#cc0000'
    }
  }

  const riverId = station.riverId ?? stationRivers?.get(station.id)?.id
  const groupId = riverId ?? `station-${station.id ?? 'unknown'}`
  const numericGroupId = Number(groupId)
  let hue

  if (Number.isFinite(numericGroupId)) {
    hue = ((numericGroupId * GOLDEN_ANGLE) % 360 + 360) % 360
  } else {
    const hash = [...String(groupId)].reduce(
      (value, character) => (value * 31 + character.charCodeAt(0)) | 0,
      0
    )
    hue = ((hash * GOLDEN_ANGLE) % 360 + 360) % 360
  }

  return {
    fillColor: `hsl(${hue.toFixed(2)}, 68%, 42%)`,
    color: `hsl(${hue.toFixed(2)}, 75%, 30%)`
  }
}

/**
 * Create safe tooltip content showing a record name and date.
 * @param {string|null} name - River or station name
 * @param {string|null} date - Observation date
 * @param {string} fallbackName - Name to display when the record is unnamed
 * @returns {HTMLElement} Tooltip DOM content
 */
export function createMapTooltipContent (name, date, fallbackName) {
  const content = document.createElement('div')
  const title = document.createElement('strong')
  const dateLine = document.createElement('div')

  title.textContent = String(name || fallbackName)
  dateLine.textContent = String(date || 'Dato ikke registrert')
  content.append(title, dateLine)

  return content
}

/**
 * Create a station tooltip with its river name, station number, and date.
 * @param {string|null} riverName - Name of the river containing the station
 * @param {string|null} stationName - Station name, optionally prefixed with the river name
 * @param {number|string} stationId - Station identifier used when its name is unavailable
 * @param {string|null} date - Station observation date
 * @returns {HTMLElement} Tooltip DOM content
 */
export function createStationMapTooltipContent (riverName, stationName, stationId, date) {
  const riverLabel = String(riverName || 'Ukjent elv')
  const stationLabel = String(stationName || '').trim()
  const riverPrefix = `${riverLabel} `
  let stationNumber = stationLabel.toLowerCase().startsWith(riverPrefix.toLowerCase())
    ? stationLabel.slice(riverPrefix.length).trim()
    : stationLabel

  if (!stationNumber || stationNumber === riverLabel) {
    stationNumber = String(stationId)
  }

  const content = document.createElement('div')
  content.textContent = `${riverLabel} - St ${stationNumber} - ${String(date || 'Dato ikke registrert')}`

  return content
}
