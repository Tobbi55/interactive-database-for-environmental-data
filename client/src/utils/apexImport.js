const REQUIRED_TRENDS_COLUMNS = [
  'date',
  'timer (s)',
  'latitude',
  'longitude',
  'status',
  'waveform',
  'average current (a)'
]

/**
 * Error raised when APEX trends data cannot be parsed safely.
 */
export class ApexImportError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ApexImportError'
  }
}

/**
 * Parse CSV records, including quoted fields, escaped quotes, and newlines.
 * @param {string} text - CSV source text
 * @returns {string[][]} CSV records
 */
function parseCsvRecords (text) {
  const records = []
  let record = []
  let field = ''
  let inQuotes = false
  let afterQuote = false

  /**
   * Finish the current field and reset CSV quote state.
   */
  function finishField () {
    record.push(field)
    field = ''
    afterQuote = false
  }

  /**
   * Finish and retain a non-empty CSV record.
   */
  function finishRecord () {
    finishField()
    if (record.some(value => value.trim() !== '')) {
      records.push(record)
    }
    record = []
  }

  for (let index = 0; index < text.length; index++) {
    const character = text[index]

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index++
        } else {
          inQuotes = false
          afterQuote = true
        }
      } else if (character === '\r' || character === '\n') {
        field += '\n'
        if (character === '\r' && text[index + 1] === '\n') index++
      } else {
        field += character
      }
      continue
    }

    if (afterQuote) {
      if (character === ',') {
        finishField()
      } else if (character === '\r' || character === '\n') {
        finishRecord()
        if (character === '\r' && text[index + 1] === '\n') index++
      } else if (!/\s/.test(character)) {
        throw new ApexImportError('CSV har ugyldig tekst etter et sitert felt.')
      }
      continue
    }

    if (character === ',') {
      finishField()
    } else if (character === '\r' || character === '\n') {
      finishRecord()
      if (character === '\r' && text[index + 1] === '\n') index++
    } else if (character === '"') {
      if (field.trim() !== '') {
        throw new ApexImportError('CSV har et anførselstegn inne i et usitert felt.')
      }
      field = ''
      inQuotes = true
    } else {
      field += character
    }
  }

  if (inQuotes) {
    throw new ApexImportError('CSV inneholder et sitert felt uten avsluttende anførselstegn.')
  }

  if (record.length > 0 || field.length > 0 || afterQuote) {
    finishRecord()
  }

  return records
}

/**
 * Parse a required numeric CSV value and report invalid rows explicitly.
 * @param {string} value - Raw field value
 * @param {number} rowNumber - One-based CSV record number
 * @param {string} column - Column name for error messages
 * @param {boolean} integer - Whether the value must be an integer
 * @returns {number} Parsed numeric value
 */
function parseRequiredNumber (value, rowNumber, column, integer = false) {
  const parsed = Number(value.trim())
  if (value.trim() === '' || !Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    throw new ApexImportError(`Ugyldig ${column} i CSV-rad ${rowNumber}.`)
  }
  return parsed
}

/**
 * Parse an optional finite number without converting blank values to zero.
 * @param {string} value - Raw field value
 * @returns {number|null} Parsed value or null when the value is absent or invalid
 */
function parseOptionalNumber (value) {
  if (value.trim() === '') return null
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Parse an APEX trends CSV into normalized rows and non-fatal data warnings.
 * @param {string} csvText - Raw trends CSV text
 * @returns {{ rows: object[], warnings: object[] }} Parsed trends and row warnings
 */
export function parseApexTrendsCsv (csvText) {
  if (typeof csvText !== 'string' || csvText.trim() === '') {
    throw new ApexImportError('Trends-filen er tom eller kan ikke leses som tekst.')
  }

  const records = parseCsvRecords(csvText.replace(/^\uFEFF/, ''))
  if (records.length < 2) {
    throw new ApexImportError('Trends-filen må inneholde en kolonnerad og minst én datarad.')
  }

  const headers = records[0].map(value => value.trim().toLocaleLowerCase('en-US'))
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index)
  if (duplicateHeaders.length > 0) {
    throw new ApexImportError(`Trends-filen inneholder dupliserte kolonner: ${[...new Set(duplicateHeaders)].join(', ')}.`)
  }

  const missingColumns = REQUIRED_TRENDS_COLUMNS.filter(column => !headers.includes(column))
  if (missingColumns.length > 0) {
    throw new ApexImportError(`Trends-filen mangler påkrevde kolonner: ${missingColumns.join(', ')}.`)
  }

  const columnIndexes = new Map(headers.map((header, index) => [header, index]))
  const warnings = []
  const rows = records.slice(1).map((record, index) => {
    const rowNumber = index + 2
    if (record.length !== headers.length) {
      throw new ApexImportError(`CSV-rad ${rowNumber} har ${record.length} felt; forventet ${headers.length}.`)
    }

    const getValue = column => record[columnIndexes.get(column)].trim()
    const date = getValue('date')
    if (date === '' || !Number.isFinite(Date.parse(date))) {
      throw new ApexImportError(`Ugyldig dato/klokkeslett i CSV-rad ${rowNumber}.`)
    }

    const timer = parseRequiredNumber(getValue('timer (s)'), rowNumber, 'Timer (s)', true)
    if (timer < 0) {
      throw new ApexImportError(`Timer (s) kan ikke være negativ i CSV-rad ${rowNumber}.`)
    }

    const status = getValue('status')
    if (status === '') {
      throw new ApexImportError(`Status mangler i CSV-rad ${rowNumber}.`)
    }

    const latitudeValue = parseOptionalNumber(getValue('latitude'))
    const longitudeValue = parseOptionalNumber(getValue('longitude'))
    let latitude = latitudeValue
    let longitude = longitudeValue
    if (
      latitude === null ||
      longitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      latitude = null
      longitude = null
      warnings.push({
        rowNumber,
        message: `GPS-koordinater mangler eller er ugyldige i CSV-rad ${rowNumber}.`
      })
    }

    const waveform = getValue('waveform')
    if (waveform === '') {
      warnings.push({
        rowNumber,
        message: `Waveform mangler i CSV-rad ${rowNumber}.`
      })
    }

    const averageCurrent = parseOptionalNumber(getValue('average current (a)'))
    if (averageCurrent === null) {
      warnings.push({
        rowNumber,
        message: `Average Current (A) mangler eller er ugyldig i CSV-rad ${rowNumber}.`
      })
    }

    return {
      sourceRow: rowNumber,
      date,
      timer,
      latitude,
      longitude,
      status,
      waveform,
      averageCurrent
    }
  })

  return { rows, warnings }
}

/**
 * Split parsed trends rows when the APEX timer resets or clearly moves backward.
 * @param {object[]} rows - Rows returned by parseApexTrendsCsv
 * @returns {object[][]} Ordered station candidate sequences
 */
export function segmentApexTrends (rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError('Trends-rader må være en array.')
  }

  const groups = []
  let currentGroup = []

  rows.forEach((row, index) => {
    if (!Number.isInteger(row?.timer) || row.timer < 0) {
      throw new ApexImportError(`Ugyldig timerverdi i trends-rad ${index + 1}.`)
    }

    const previousRow = rows[index - 1]
    const startsNewGroup = previousRow && (
      row.timer === 0 ||
      (row.timer === 1 && previousRow.timer !== 0) ||
      row.timer < previousRow.timer - 5
    )

    if (startsNewGroup) {
      groups.push(currentGroup)
      currentGroup = []
    }

    currentGroup.push(row)
  })

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

/**
 * Validate required columns and values in an optional faults/events CSV.
 * @param {string} csvText - Supporting CSV text
 * @param {'faults'|'events'} fileType - The supporting file type
 * @returns {number} Number of data rows
 */
function validateSupportingCsv (csvText, fileType) {
  const columnConfig = {
    faults: {
      label: 'Faults',
      requiredColumns: ['date', 'fault code', 'fault title'],
      requiredValues: ['date', 'fault code', 'fault title']
    },
    events: {
      label: 'Events',
      requiredColumns: ['date', 'event'],
      requiredValues: ['date', 'event']
    }
  }[fileType]

  const records = parseCsvRecords(csvText.replace(/^\uFEFF/, ''))
  if (records.length === 0) {
    throw new ApexImportError(`${columnConfig.label}-filen er tom.`)
  }

  const headers = records[0].map(value => value.trim().toLocaleLowerCase('en-US'))
  const missingColumns = columnConfig.requiredColumns.filter(column => !headers.includes(column))
  if (missingColumns.length > 0) {
    throw new ApexImportError(`${columnConfig.label}-filen mangler kolonner: ${missingColumns.join(', ')}.`)
  }

  const columnIndexes = new Map(headers.map((header, index) => [header, index]))
  records.slice(1).forEach((record, index) => {
    const rowNumber = index + 2
    if (record.length !== headers.length) {
      throw new ApexImportError(`${columnConfig.label}-rad ${rowNumber} har feil antall felt.`)
    }

    columnConfig.requiredValues.forEach(column => {
      const value = record[columnIndexes.get(column)].trim()
      if (value === '') {
        throw new ApexImportError(`${columnConfig.label}-rad ${rowNumber} mangler ${column}.`)
      }
      if (column === 'date' && !Number.isFinite(Date.parse(value))) {
        throw new ApexImportError(`${columnConfig.label}-rad ${rowNumber} har ugyldig dato/klokkeslett.`)
      }
    })
  })

  return records.length - 1
}

/**
 * Validate a selected local set of APEX CSV files and parse its trends data.
 * Trends is required; faults and events are optional supporting files.
 * @param {File[]|FileList} files - Files selected by the user
 * @returns {Promise<object>} Parsed trends, station groups, and file validation summary
 */
export async function validateApexCsvFiles (files) {
  const selectedFiles = Array.from(files || [])
  if (selectedFiles.length === 0) {
    throw new ApexImportError('Velg minst én APEX CSV-fil.')
  }

  const filesByType = new Map()
  const deviceIds = new Map()
  selectedFiles.forEach(file => {
    if (!file || typeof file.name !== 'string' || typeof file.text !== 'function') {
      throw new ApexImportError('En valgt fil kan ikke leses som en lokal tekstfil.')
    }

    const match = /^([a-z0-9-]+)_(trends|faults|events)\.csv$/i.exec(file.name)
    if (!match) {
      throw new ApexImportError(`Ukjent APEX-filnavn: ${file.name}. Forventet *_trends.csv, *_faults.csv eller *_events.csv.`)
    }

    const deviceId = match[1]
    const fileType = match[2].toLowerCase()
    if (filesByType.has(fileType)) {
      throw new ApexImportError(`Velg bare én ${fileType}-fil.`)
    }

    filesByType.set(fileType, file)
    deviceIds.set(fileType, deviceId)
  })

  if (!filesByType.has('trends')) {
    throw new ApexImportError('Velg APEX trends-filen (*_trends.csv).')
  }

  const trendsDeviceId = deviceIds.get('trends')
  for (const [fileType, deviceId] of deviceIds) {
    if (deviceId.toLowerCase() !== trendsDeviceId.toLowerCase()) {
      throw new ApexImportError(`APEX ${fileType}-filen må ha samme enhets-ID som trends-filen.`)
    }
  }

  const fileContents = new Map()
  await Promise.all([...filesByType].map(async ([fileType, file]) => {
    fileContents.set(fileType, await file.text())
  }))

  const parsedTrends = parseApexTrendsCsv(fileContents.get('trends'))
  const groups = segmentApexTrends(parsedTrends.rows)
  const faultCount = filesByType.has('faults')
    ? validateSupportingCsv(fileContents.get('faults'), 'faults')
    : null
  const eventCount = filesByType.has('events')
    ? validateSupportingCsv(fileContents.get('events'), 'events')
    : null

  return {
    deviceId: trendsDeviceId,
    trends: parsedTrends.rows,
    groups,
    warnings: parsedTrends.warnings,
    files: {
      trends: filesByType.get('trends').name,
      faults: filesByType.get('faults')?.name ?? null,
      events: filesByType.get('events')?.name ?? null
    },
    faultCount,
    eventCount
  }
}
