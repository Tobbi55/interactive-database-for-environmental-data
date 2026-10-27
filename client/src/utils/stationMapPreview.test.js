import { describe, expect, it } from 'vitest'
import {
  createStationMapDrafts,
  formatMapCoordinate,
  getStationMapSnapshot,
  isValidMapPosition,
  parseMapCoordinate,
  parseMapPosition,
  validateStationMapDrafts
} from './stationMapPreview.js'

describe('station map preview helpers', () => {
  it('copies only map fields and keeps source stations unchanged', () => {
    const stations = [{
      key: 4,
      number: 3,
      startTime: '09:20',
      startLat: '61,25',
      startLong: '10,42',
      endLat: '61,26',
      endLong: '10,43',
      transectLength: '250',
      secondsFished: '300',
      description: 'Manually entered',
      observations: [{ species: 'ørret' }]
    }]

    const drafts = createStationMapDrafts(stations)

    expect(drafts[0]).toEqual({
      key: 4,
      number: '3',
      startTime: '09:20',
      startLat: '61,25',
      startLong: '10,42',
      endLat: '61,26',
      endLong: '10,43',
      transectLength: '250',
      secondsFished: '300'
    })
    expect(stations[0].description).toBe('Manually entered')
    expect(stations[0].observations).toHaveLength(1)
  })

  it('parses and formats comma-decimal coordinates for the map', () => {
    expect(parseMapCoordinate('61,250001')).toBe(61.250001)
    expect(parseMapCoordinate('')).toBeNull()
    expect(parseMapCoordinate('61.25')).toBeNull()
    expect(formatMapCoordinate(61.2500012)).toBe('61,250001')
    expect(isValidMapPosition('61,25', '10,42')).toBe(true)
    expect(parseMapPosition('61,25', '10,42')).toEqual([61.25, 10.42])
    expect(parseMapPosition('91', '10')).toBeNull()
    expect(isValidMapPosition('91', '10')).toBe(false)
    expect(isValidMapPosition('61', '181')).toBe(false)
  })

  it('detects duplicate or invalid station numbers and out-of-range coordinates', () => {
    expect(validateStationMapDrafts([
      { key: 1, number: '2', startLat: '61,2', startLong: '10,4', endLat: '', endLong: '' },
      { key: 2, number: '2', startLat: '91', startLong: '', endLat: '', endLong: '' },
      { key: 3, number: '0', startLat: '61.', startLong: '', endLat: '', endLong: '' }
    ])).toEqual(expect.arrayContaining([
      'Stasjonsnummer 2 er brukt flere ganger.',
      'Stasjon 2: startbreddegrad må være et gyldig desimaltall med komma.',
      'Stasjon 0: stasjonsnummer må være et positivt heltall.',
      'Stasjon 0: startbreddegrad må være et gyldig desimaltall med komma.'
    ]))
  })

  it('validates editable time and numeric station values', () => {
    expect(validateStationMapDrafts([{
      key: 1,
      number: '1',
      startTime: '27:89',
      transectLength: '-1',
      secondsFished: 'not-a-number'
    }])).toEqual(expect.arrayContaining([
      'Stasjon 1: klokkeslett må være gyldig i 24-timers format.',
      'Stasjon 1: transektlengde må være et tall større enn eller lik null.',
      'Stasjon 1: sekunder fisket må være et tall større enn eller lik null.'
    ]))
  })

  it('changes its snapshot when any editable station field changes', () => {
    const draft = { key: 1, number: '1', startLat: '61,2', startLong: '10,4', endLat: '', endLong: '' }
    const original = getStationMapSnapshot([draft])

    expect(getStationMapSnapshot([{ ...draft, startTime: '09:30' }])).not.toBe(original)
    expect(getStationMapSnapshot([{ ...draft, number: '2' }])).not.toBe(original)
    expect(getStationMapSnapshot([{ ...draft, transectLength: '300' }])).not.toBe(original)
  })
})
