import { describe, expect, it } from 'vitest'
import {
  ApexImportError,
  parseApexTrendsCsv,
  segmentApexTrends,
  validateApexCsvFiles
} from './apexImport.js'

const header = 'Date,Timer (s),Latitude,Longitude,Status,Waveform,Average Current (A)'

/**
 * Create one APEX trends row with defaults suitable for parser tests.
 * @param {number|string} timer - Timer value
 * @param {object} values - Optional CSV field overrides
 * @returns {string} CSV row
 */
function trendsRow (timer, values = {}) {
  const {
    date = `2026-06-30 09:00:${String(timer).padStart(2, '0')}+02:00`,
    latitude = '61.25',
    longitude = '10.42',
    status = 'p',
    waveform = '1000V 40% 120Hz',
    averageCurrent = '4.1'
  } = values
  return [date, timer, latitude, longitude, status, waveform, averageCurrent].join(',')
}

describe('parseApexTrendsCsv', () => {
  it('parses BOM-prefixed, reordered headers and quoted CSV fields', () => {
    const csv = [
      '\uFEFFWaveform,Longitude,Date,Average Current (A),Status,Timer (s),Latitude',
      '"1000V, 40% 120Hz",10.42,2026-06-30 09:00:05+02:00,4.1,p,5,61.25'
    ].join('\r\n')

    const result = parseApexTrendsCsv(csv)

    expect(result.rows).toEqual([{
      sourceRow: 2,
      date: '2026-06-30 09:00:05+02:00',
      timer: 5,
      latitude: 61.25,
      longitude: 10.42,
      status: 'p',
      waveform: '1000V, 40% 120Hz',
      averageCurrent: 4.1
    }])
    expect(result.warnings).toEqual([])
  })

  it('reports required columns that are missing', () => {
    expect(() => parseApexTrendsCsv('Date,Timer (s)\n2026-06-30,5'))
      .toThrow('Trends-filen mangler påkrevde kolonner')
  })

  it('rejects malformed quoting and inconsistent row widths', () => {
    expect(() => parseApexTrendsCsv(`${header}\n${trendsRow(5, { waveform: '"unfinished' })}`))
      .toThrow(ApexImportError)
    expect(() => parseApexTrendsCsv(`${header}\n${trendsRow(5)},unexpected`))
      .toThrow('forventet 7')
  })

  it.each([
    ['invalid date', { date: 'not a date' }, 'dato/klokkeslett'],
    ['invalid timer', { timer: '1.5' }, 'Timer (s)'],
    ['negative timer', { timer: '-1' }, 'Timer (s)'],
    ['missing status', { status: '' }, 'Status']
  ])('rejects %s', (_description, values, message) => {
    const timer = values.timer ?? 5
    expect(() => parseApexTrendsCsv(`${header}\n${trendsRow(timer, values)}`))
      .toThrow(message)
  })

  it('warns on invalid coordinates and current without silently dropping rows', () => {
    const csv = `${header}\n${trendsRow(5, {
      latitude: '91',
      longitude: '',
      averageCurrent: 'unknown'
    })}`

    const result = parseApexTrendsCsv(csv)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      latitude: null,
      longitude: null,
      averageCurrent: null
    })
    expect(result.warnings.map(({ message }) => message)).toEqual([
      'GPS-koordinater mangler eller er ugyldige i CSV-rad 2.',
      'Average Current (A) mangler eller er ugyldig i CSV-rad 2.'
    ])
  })

  it('skips blank lines and warns when waveform is missing', () => {
    const csv = `${header}\n\n${trendsRow(5, { waveform: '' })}\n`

    const result = parseApexTrendsCsv(csv)

    expect(result.rows).toHaveLength(1)
    expect(result.warnings).toEqual([
      { rowNumber: 2, message: 'Waveform mangler i CSV-rad 2.' }
    ])
  })

  it('rejects empty CSV and a header without data', () => {
    expect(() => parseApexTrendsCsv('')).toThrow('tom eller kan ikke leses')
    expect(() => parseApexTrendsCsv(header)).toThrow('minst én datarad')
  })
})

describe('segmentApexTrends', () => {
  it('splits at timer resets to zero, reset to one, and a drop greater than five seconds', () => {
    const rows = [0, 1, 2, 0, 1, 10, 4, 5].map(timer => ({ timer }))

    expect(segmentApexTrends(rows).map(group => group.map(row => row.timer)))
      .toEqual([[0, 1, 2], [0, 1, 10], [4, 5]])
  })

  it('does not split normal zero-to-one progress or a timer drop of exactly five seconds', () => {
    const rows = [0, 1, 10, 5].map(timer => ({ timer }))

    expect(segmentApexTrends(rows).map(group => group.map(row => row.timer)))
      .toEqual([[0, 1, 10, 5]])
  })

  it('keeps row order and returns no groups for empty input', () => {
    const rows = [{ timer: 0 }, { timer: 3 }]

    expect(segmentApexTrends(rows)).toEqual([rows])
    expect(segmentApexTrends([])).toEqual([])
  })

  it('rejects invalid timer values', () => {
    expect(() => segmentApexTrends([{ timer: -1 }])).toThrow(ApexImportError)
    expect(() => segmentApexTrends(null)).toThrow(TypeError)
  })
})

describe('validateApexCsvFiles', () => {
  const faultsCsv = [
    'Date,Fault Code,Fault Title',
    '2026-06-30 09:30:07+02:00,66,Changing Voltage Range'
  ].join('\n')
  const eventsCsv = [
    'Date,Event',
    '2026-06-30 09:30:07+02:00,Boat 1.10'
  ].join('\n')

  /**
   * Make a minimal local-file stub for file-set validation tests.
   * @param {string} name - The CSV file name
   * @param {string} content - CSV file content
   * @returns {{name: string, text: () => Promise<string>}} File-like object
   */
  function localFile (name, content) {
    return { name, text: async () => content }
  }

  it('requires trends and accepts optional faults/events from the same device', async () => {
    const result = await validateApexCsvFiles([
      localFile('ABXG123456_trends.csv', `${header}\n${trendsRow(5)}`),
      localFile('ABXG123456_faults.csv', faultsCsv),
      localFile('ABXG123456_events.csv', eventsCsv)
    ])

    expect(result).toMatchObject({
      deviceId: 'ABXG123456',
      faultCount: 1,
      eventCount: 1,
      files: {
        trends: 'ABXG123456_trends.csv',
        faults: 'ABXG123456_faults.csv',
        events: 'ABXG123456_events.csv'
      }
    })
    expect(result.groups).toHaveLength(1)
  })

  it('accepts trends without optional files', async () => {
    const result = await validateApexCsvFiles([
      localFile('ABXG123456_trends.csv', `${header}\n${trendsRow(5)}`)
    ])

    expect(result.faultCount).toBeNull()
    expect(result.eventCount).toBeNull()
    expect(result.files.faults).toBeNull()
    expect(result.files.events).toBeNull()
  })

  it('rejects missing trends, duplicate file types, unrecognized names, and mismatched device IDs', async () => {
    await expect(validateApexCsvFiles([
      localFile('ABXG123456_events.csv', eventsCsv)
    ])).rejects.toThrow('trends-filen')

    await expect(validateApexCsvFiles([
      localFile('ABXG123456_trends.csv', `${header}\n${trendsRow(5)}`),
      localFile('ABXG123456_TRENDS.CSV', `${header}\n${trendsRow(5)}`)
    ])).rejects.toThrow('bare én trends-fil')

    await expect(validateApexCsvFiles([
      localFile('trends.csv', `${header}\n${trendsRow(5)}`)
    ])).rejects.toThrow('Ukjent APEX-filnavn')

    await expect(validateApexCsvFiles([
      localFile('ABXG123456_trends.csv', `${header}\n${trendsRow(5)}`),
      localFile('ABXG654321_faults.csv', faultsCsv)
    ])).rejects.toThrow('samme enhets-ID')
  })

  it('rejects invalid supporting-file schemas and row values', async () => {
    await expect(validateApexCsvFiles([
      localFile('ABXG123456_trends.csv', `${header}\n${trendsRow(5)}`),
      localFile('ABXG123456_faults.csv', 'Date,Fault Code\n2026-06-30,66')
    ])).rejects.toThrow('mangler kolonner')

    await expect(validateApexCsvFiles([
      localFile('ABXG123456_trends.csv', `${header}\n${trendsRow(5)}`),
      localFile('ABXG123456_events.csv', 'Date,Event\nnot-a-date,Boat')
    ])).rejects.toThrow('ugyldig dato/klokkeslett')
  })

  it('rejects an empty selection', async () => {
    await expect(validateApexCsvFiles([])).rejects.toThrow('Velg minst én')
  })
})
