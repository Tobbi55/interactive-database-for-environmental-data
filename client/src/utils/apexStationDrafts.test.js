import { describe, expect, it } from 'vitest'
import {
  createApexStationDrafts,
  estimateEditedTransectLength,
  mergeApexStationDraft
} from './apexStationDrafts.js'

/**
 * Create one parsed trends row with defaults suitable for station mapping tests.
 * @param {number} timer - Timer value
 * @param {object} values - Optional row overrides
 * @returns {object} Parsed trends row
 */
function trendsRow (timer, values = {}) {
  return {
    sourceRow: timer + 2,
    date: '2026-06-30 09:29:49+02:00',
    timer,
    latitude: 61,
    longitude: 10,
    status: 'p',
    waveform: '1000V 40% 120Hz',
    averageCurrent: 4.1,
    ...values
  }
}

describe('createApexStationDrafts', () => {
  it('calculates edited transect length only between the endpoints', () => {
    const station = {
      startLat: '61,25',
      startLong: '10,42',
      endLat: '61,27',
      endLong: '10,43'
    }

    expect(estimateEditedTransectLength(station)).toBe(2287)
    expect(estimateEditedTransectLength({ ...station, endLong: '' })).toBeNull()
  })

  it('maps timer sequence values to editable station fields and assigns sequential numbers', () => {
    const group = [
      trendsRow(0, { latitude: 61, longitude: 10, averageCurrent: 4.1 }),
      trendsRow(5, { latitude: 61.0005, longitude: 10.0005, averageCurrent: 4.2 }),
      trendsRow(10, {
        latitude: 61.001,
        longitude: 10.001,
        waveform: '1200V 30% 100Hz',
        averageCurrent: 4.3
      }),
      trendsRow(300, { latitude: 61.002, longitude: 10.002, averageCurrent: 4.4 })
    ]

    const result = createApexStationDrafts([group, [trendsRow(0), trendsRow(5), trendsRow(30)]])

    expect(result.stations).toHaveLength(2)
    expect(result.stations[0]).toEqual({
      number: '1',
      date: '2026-06-30',
      startTime: '09:29',
      startLat: '61,0005',
      startLong: '10,0005',
      endLat: '61,002',
      endLong: '10,002',
      transectLength: expect.any(String),
      secondsFished: '300',
      voltage: '1000',
      pulse: '120',
      display: '4,25'
    })
    expect(result.stations[1].number).toBe('2')
    expect(result.warnings.map(({ field }) => field)).toContain('voltage')
    expect(result.warnings.map(({ field }) => field)).toContain('pulse')
  })

  it('clears a measurable GPS path length when either endpoint is missing', () => {
    const group = [
      trendsRow(0),
      trendsRow(4, { latitude: 61.0004, longitude: 10.0004 }),
      trendsRow(5, { latitude: null, longitude: null })
    ]

    const { stations, warnings } = createApexStationDrafts([group])

    expect(stations[0].startLat).toBe('')
    expect(stations[0].endLat).toBe('')
    expect(stations[0].transectLength).toBe('')
    expect(warnings).toContainEqual(expect.objectContaining({ field: 'transectLength' }))
  })

  it('uses local date and time from the first row without shifting timezone', () => {
    const group = [
      trendsRow(0, { date: '2026-06-30T23:59:49-04:00' }),
      trendsRow(5),
      trendsRow(60)
    ]

    const { stations } = createApexStationDrafts([group])

    expect(stations[0]).toMatchObject({
      date: '2026-06-30',
      startTime: '23:59'
    })
  })

  describe('mergeApexStationDraft', () => {
    it('replaces mapped values, synchronizes editable time selectors, and preserves manual data', () => {
      const station = {
        key: 5,
        number: '8',
        date: '2025-01-01',
        startTime: '10:30',
        startHour: '10',
        startMinute: '30',
        startLat: '60,1',
        boatType: 'Cataraft',
        weather: 'Sol',
        description: 'Manuell beskrivelse',
        observations: [{ key: 12, species: 'ørret', count: '2' }]
      }
      const draft = {
        number: '1',
        date: '2026-06-30',
        startTime: '09:29',
        startLat: '61,0005',
        startLong: '',
        endLat: '61,002',
        endLong: '10,002',
        transectLength: '347',
        secondsFished: '300',
        voltage: '1000',
        pulse: '120',
        display: '4,25',
        description: 'Skal ikke kopieres fra utkastet',
        unexpectedField: 'Skal ignoreres'
      }

      const mergedStation = mergeApexStationDraft(station, draft)

      expect(mergedStation).toMatchObject({
        ...station,
        number: '1',
        date: '2026-06-30',
        startTime: '09:29',
        startHour: '09',
        startMinute: '29',
        startLat: '61,0005',
        startLong: '',
        endLat: '61,002',
        endLong: '10,002',
        transectLength: '347',
        secondsFished: '300',
        voltage: '1000',
        pulse: '120',
        display: '4,25'
      })
      expect(mergedStation).not.toHaveProperty('unexpectedField')
    })

    it('defaults the boat type to Cataraft when importing into a station without one', () => {
      const station = { boatType: '' }
      const draft = { startTime: '09:29' }

      expect(mergeApexStationDraft(station, draft).boatType).toBe('Cataraft')
      expect(mergeApexStationDraft({ boatType: 'Volt Maria' }, draft).boatType).toBe('Volt Maria')
    })

    it('rejects a draft with an invalid start time', () => {
      expect(() => mergeApexStationDraft({}, { startTime: '9:2' }))
        .toThrow('APEX-utkastet inneholder ugyldig starttid.')
    })
  })

  it('uses the first valid GPS position at or after timer five when the exact sample is missing', () => {
    const group = [
      trendsRow(0),
      trendsRow(4, { latitude: 61.1 }),
      trendsRow(6, { latitude: 61.2, longitude: 10.2 }),
      trendsRow(30, { latitude: 61.3, longitude: 10.3 })
    ]

    const { stations, warnings } = createApexStationDrafts([group])

    expect(stations[0].startLat).toBe('61,2')
    expect(stations[0].startLong).toBe('10,2')
    expect(warnings).toContainEqual(expect.objectContaining({
      field: 'startLat',
      message: expect.stringContaining('timer 6')
    }))
  })

  it('leaves unavailable start/stop coordinates blank and reports them', () => {
    const group = [
      trendsRow(0, { latitude: null, longitude: null }),
      trendsRow(5, { latitude: null, longitude: null }),
      trendsRow(20, { latitude: null, longitude: null })
    ]

    const { stations, warnings } = createApexStationDrafts([group])

    expect(stations[0]).toMatchObject({
      startLat: '',
      startLong: '',
      endLat: '',
      endLong: ''
    })
    expect(warnings.map(({ field }) => field)).toContain('startLat')
    expect(warnings.map(({ field }) => field)).toContain('endLat')
  })

  it('leaves pulse empty for DC waveforms and uses the nominal voltage', () => {
    const group = [
      trendsRow(0, { waveform: '1000VDC' }),
      trendsRow(5, { waveform: '1000VDC' }),
      trendsRow(30, { waveform: '1000VDC' })
    ]

    const { stations, warnings } = createApexStationDrafts([group])

    expect(stations[0]).toMatchObject({ voltage: '1000', pulse: '' })
    expect(warnings).toContainEqual(expect.objectContaining({
      field: 'pulse',
      message: expect.stringContaining('fyll inn manuelt')
    }))
  })

  it('uses the most common voltage and pulse independently, with warnings for variation', () => {
    const group = [
      trendsRow(0, { waveform: '1000V 30% 120Hz' }),
      trendsRow(5, { waveform: '1000V 40% 120Hz' }),
      trendsRow(10, { waveform: '1200V 40% 100Hz' })
    ]

    const { stations, warnings } = createApexStationDrafts([group])

    expect(stations[0]).toMatchObject({ voltage: '1000', pulse: '120' })
    expect(warnings.filter(({ field }) => ['voltage', 'pulse'].includes(field))).toHaveLength(2)
  })

  it('leaves a tied most-common value blank for manual correction', () => {
    const group = [
      trendsRow(0, { waveform: '1000V 40% 120Hz' }),
      trendsRow(5, { waveform: '1200V 40% 100Hz' })
    ]

    const { stations, warnings } = createApexStationDrafts([group])

    expect(stations[0]).toMatchObject({ voltage: '', pulse: '' })
    expect(warnings.filter(({ message }) => message.includes('Kunne ikke velge en entydig verdi')))
      .toHaveLength(2)
  })

  it('averages current over active rows and excludes non-active statuses', () => {
    const group = [
      trendsRow(0, { status: 'pr', averageCurrent: 100 }),
      trendsRow(5, { averageCurrent: 4.1 }),
      trendsRow(10, { averageCurrent: 4.3 })
    ]

    const { stations } = createApexStationDrafts([group])

    expect(stations[0].display).toBe('4,2')
  })

  it('estimates path length from all valid points and leaves it blank with fewer than two points', () => {
    const group = [
      trendsRow(0, { latitude: 0, longitude: 0 }),
      trendsRow(5, { latitude: 0, longitude: 0.001 }),
      trendsRow(10, { latitude: 0, longitude: 0.002 })
    ]
    const singlePointGroup = [trendsRow(0, { latitude: 0, longitude: 0 })]

    const { stations, warnings } = createApexStationDrafts([group, singlePointGroup])

    expect(Number(stations[0].transectLength)).toBeGreaterThan(200)
    expect(stations[1].transectLength).toBe('')
    expect(warnings).toContainEqual(expect.objectContaining({ field: 'transectLength' }))
  })

  it('does not include fields that must remain manual or fish observations', () => {
    const { stations } = createApexStationDrafts([[
      trendsRow(0),
      trendsRow(5),
      trendsRow(30)
    ]])

    expect(stations[0]).not.toHaveProperty('weather')
    expect(stations[0]).not.toHaveProperty('riverType')
    expect(stations[0]).not.toHaveProperty('waterTemp')
    expect(stations[0]).not.toHaveProperty('observations')
    expect(stations[0]).not.toHaveProperty('description')
  })

  it('rejects empty and invalid station groups', () => {
    expect(() => createApexStationDrafts([[]])).toThrow('tom eller ugyldig')
    expect(() => createApexStationDrafts(null)).toThrow(TypeError)
  })
})
