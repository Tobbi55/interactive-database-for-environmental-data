/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApexImportPanel from './ApexImportPanel.svelte'
import { validateApexCsvFiles } from '../utils/apexImport.js'

vi.mock('../utils/apexImport.js', () => ({
  validateApexCsvFiles: vi.fn()
}))

/**
 * Build a trends row fixture for station draft transformation tests.
 * @param {number} timer - Timer value
 * @param {object} values - Optional row overrides
 * @returns {object} Trends row
 */
function trendsRow (timer, values = {}) {
  return {
    sourceRow: timer + 2,
    date: '2026-06-30 09:29:49+02:00',
    timer,
    latitude: 61 + timer / 100000,
    longitude: 10 + timer / 100000,
    status: 'p',
    waveform: '1000V 40% 120Hz',
    averageCurrent: 4.1,
    ...values
  }
}

describe('ApexImportPanel', () => {
  beforeEach(() => {
    validateApexCsvFiles.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('validates selected CSV files locally without making a network request', async () => {
    const file = new File(['csv content'], 'ABXG123456_trends.csv', { type: 'text/csv' })
    const group = [trendsRow(0), trendsRow(5), trendsRow(10)]
    validateApexCsvFiles.mockResolvedValue({
      trends: group,
      groups: [group],
      warnings: []
    })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const validated = vi.fn()
    const { component, getByLabelText, getByRole } = render(ApexImportPanel)
    component.$on('validated', validated)

    await fireEvent.change(getByLabelText('Velg APEX CSV-filer'), {
      target: { files: [file] }
    })

    await waitFor(() => {
      expect(getByRole('status').textContent).toContain('3 trends-rader og 1 stasjonssekvenser')
    })
    expect(validateApexCsvFiles).toHaveBeenCalledWith([file])
    expect(validated.mock.calls[0][0].detail.data.stations[0]).toMatchObject({
      number: '1',
      date: '2026-06-30',
      startTime: '09:29',
      secondsFished: '10'
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('shows the helper dialog independently of importing', async () => {
    const { getByRole, getByText } = render(ApexImportPanel)

    await fireEvent.click(getByRole('button', { name: 'Hjelp' }))

    expect(getByRole('dialog').getAttribute('aria-labelledby')).toBe('apex-helper-title')
    expect(getByText('Eksempel på _trends.csv')).toBeTruthy()
    expect(validateApexCsvFiles).not.toHaveBeenCalled()
  })

  it('shows station-field warnings and leaves ambiguous values for manual entry', async () => {
    const group = [
      trendsRow(0, { waveform: '1000V 40% 120Hz' }),
      trendsRow(5, { waveform: '1200V 30% 100Hz' })
    ]
    validateApexCsvFiles.mockResolvedValue({
      trends: group,
      groups: [group],
      warnings: []
    })
    const validated = vi.fn()
    const { component, getByLabelText, getByRole } = render(ApexImportPanel)
    component.$on('validated', validated)

    await fireEvent.change(getByLabelText('Velg APEX CSV-filer'), {
      target: {
        files: [new File(['csv content'], 'ABXG123456_trends.csv', { type: 'text/csv' })]
      }
    })

    const warnings = await waitFor(() => getByRole('status', {
      name: 'Advarsler fra APEX-importen'
    }))
    expect(warnings.textContent).toContain('verdier krever kontroll')
    expect(validated.mock.calls[0][0].detail.data.stations[0]).toMatchObject({
      voltage: '',
      pulse: ''
    })
  })

  it('shows readable validation errors', async () => {
    validateApexCsvFiles.mockRejectedValue(new Error('Velg APEX trends-filen.'))
    const file = new File(['csv content'], 'ABXG123456_faults.csv', { type: 'text/csv' })
    const { getByLabelText, getByRole } = render(ApexImportPanel)

    await fireEvent.change(getByLabelText('Velg APEX CSV-filer'), {
      target: { files: [file] }
    })

    expect(await waitFor(() => getByRole('alert').textContent)).toContain('Velg APEX trends-filen.')
  })
})
