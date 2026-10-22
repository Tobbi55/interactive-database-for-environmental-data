/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest'
import { createMapTooltipContent, createStationMapTooltipContent, getStationMapColors } from './mapDisplay.js'

describe('map display helpers', () => {
  it('uses one color for stations belonging to the same river and distinct colors for different rivers', () => {
    const riverOneStation = getStationMapColors({ id: 1, riverId: 12 }, true)
    const anotherRiverOneStation = getStationMapColors({ id: 2, riverId: 12 }, true)
    const riverTwoStation = getStationMapColors({ id: 3, riverId: 24 }, true)

    expect(riverOneStation).toEqual(anotherRiverOneStation)
    expect(riverTwoStation).not.toEqual(riverOneStation)
  })

  it('uses the default red color when separate river colors are disabled', () => {
    expect(getStationMapColors({ id: 1, riverId: 12 }, false)).toEqual({
      fillColor: '#ff3333',
      color: '#cc0000'
    })
  })

  it('groups stations with missing riverId using the station-to-river relationship map', () => {
    const stationRivers = new Map([
      [1, { id: 8, name: 'River Eight' }],
      [2, { id: 8, name: 'River Eight' }],
      [100, { id: 3, name: 'River Three' }]
    ])

    const firstSameRiverStation = getStationMapColors({ id: 1, riverId: null }, true, stationRivers)
    const secondSameRiverStation = getStationMapColors({ id: 2, riverId: null }, true, stationRivers)
    const otherRiverStation = getStationMapColors({ id: 100, riverId: null }, true, stationRivers)

    expect(firstSameRiverStation).toEqual(secondSameRiverStation)
    expect(otherRiverStation).not.toEqual(firstSameRiverStation)
  })

  it('creates safe tooltip content containing the name and date', () => {
    const tooltip = createMapTooltipContent('<img src=x onerror=alert(1)>', '2026-10-22', 'Elv')

    expect(tooltip.textContent).toBe('<img src=x onerror=alert(1)>2026-10-22')
    expect(tooltip.querySelector('img')).toBeNull()
  })

  it('uses readable fallback values when name or date is missing', () => {
    const tooltip = createMapTooltipContent('', null, 'Elv')

    expect(tooltip.textContent).toBe('ElvDato ikke registrert')
  })

  it('shows the river name, station number, and date in station tooltips', () => {
    const tooltip = createStationMapTooltipContent('Gaula', 'Gaula 12', 12, '2021-09-30')

    expect(tooltip.textContent).toBe('Gaula - St 12 - 2021-09-30')
  })

  it('uses text content for station tooltips and handles names without a river prefix', () => {
    const tooltip = createStationMapTooltipContent('<img src=x>', '12', 12, '2021-09-30')

    expect(tooltip.textContent).toBe('<img src=x> - St 12 - 2021-09-30')
    expect(tooltip.querySelector('img')).toBeNull()
  })
})
