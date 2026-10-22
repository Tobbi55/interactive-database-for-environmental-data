/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddDataPage from '../routes/add-data/+page.svelte'
import { validateApexCsvFiles } from '../utils/apexImport.js'

vi.mock('../utils/apexImport.js', () => ({
  validateApexCsvFiles: vi.fn()
}))

vi.mock('$app/stores', () => ({
  page: {
    subscribe: (run) => {
      run({ url: { pathname: '/add-data' } })
      return () => {}
    }
  }
}))

/**
 * Build one trends row with valid station values for the form integration test.
 * @param {number} timer - Timer value
 * @param {string} date - Logger timestamp
 * @param {object} values - Optional row overrides
 * @returns {object} Trends row
 */
function trendsRow (timer, date, values = {}) {
  return {
    sourceRow: timer + 2,
    date,
    timer,
    latitude: 61 + timer / 100000,
    longitude: 10 + timer / 100000,
    status: 'p',
    waveform: '1000V 40% 120Hz',
    averageCurrent: 4.1,
    ...values
  }
}

/**
 * Build a complete timer sequence for one imported station.
 * @param {string} date - Date portion of the logger timestamp
 * @returns {object[]} Trends rows
 */
function stationGroup (date) {
  return [
    trendsRow(0, `${date} 09:00:00+02:00`),
    trendsRow(5, `${date} 09:00:05+02:00`),
    trendsRow(10, `${date} 09:00:10+02:00`)
  ]
}

/**
 * Select a local trends CSV file through the import panel.
 * @param {HTMLElement} container - Rendered page container
 * @param {string} name - File name to select
 * @returns {Promise<boolean>} Whether the input event was dispatched
 */
function importFile (container, name) {
  const file = new File(['csv content'], name, { type: 'text/csv' })
  return fireEvent.change(container.querySelector('[aria-label="Velg APEX CSV-filer"]'), {
    target: { files: [file] }
  })
}

describe('add-data APEX import', () => {
  beforeEach(() => {
    validateApexCsvFiles.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('fills editable station fields, preserves manual data, and confirms before removing populated stations', async () => {
    const firstImportGroups = [
      stationGroup('2026-06-30'),
      stationGroup('2026-07-01')
    ]
    const replacementGroup = stationGroup('2026-08-15')
    validateApexCsvFiles
      .mockResolvedValueOnce({
        trends: firstImportGroups.flat(),
        groups: firstImportGroups,
        warnings: []
      })
      .mockResolvedValue({
        trends: replacementGroup,
        groups: [replacementGroup],
        warnings: []
      })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const page = render(AddDataPage)
    const originalStation = page.container.querySelector('.stationCard')

    await fireEvent.input(within(originalStation).getByLabelText('Stasjonsbeskrivelse'), {
      target: { value: 'Behold denne teksten' }
    })
    await fireEvent.input(within(originalStation).getByLabelText('Lengde for rad 1'), {
      target: { value: '250' }
    })
    await importFile(page.container, 'ABXG123456_trends.csv')

    await waitFor(() => {
      expect(page.container.querySelectorAll('.stationCard')).toHaveLength(2)
    })
    let stations = page.container.querySelectorAll('.stationCard')
    expect(within(stations[0]).getByLabelText(/Dato/).value).toBe('2026-06-30')
    expect(within(stations[0]).getByLabelText('Klokkeslett start, time for stasjon 1').value).toBe('09')
    expect(within(stations[0]).getByLabelText(/Lat start/).value).toBe('61,00005')
    expect(within(stations[0]).getByLabelText(/Long start/).value).toBe('10,00005')
    expect(within(stations[0]).getByLabelText(/Lat stopp/).value).toBe('61,0001')
    expect(within(stations[0]).getByLabelText(/Sekunder fisket/).value).toBe('10')
    expect(within(stations[0]).getByLabelText(/Volt/).value).toBe('1000')
    expect(within(stations[0]).getByLabelText(/Puls \(DC\)/).value).toBe('120')
    expect(Number(within(stations[0]).getByLabelText(/Transektlengde/).value)).toBeGreaterThan(0)
    expect(within(stations[0]).getByLabelText(/Båttype/).value).toBe('Cataraft')
    expect(within(stations[0]).getByLabelText('Stasjonsbeskrivelse').value).toBe('Behold denne teksten')
    expect(within(stations[0]).getByLabelText('Lengde for rad 1').value).toBe('250')
    await fireEvent.input(within(stations[0]).getByLabelText(/Lat start/), {
      target: { value: '' }
    })
    expect(within(stations[0]).getByLabelText(/Transektlengde/).value).toBe('')

    await fireEvent.input(within(stations[0]).getByLabelText(/Volt/), {
      target: { value: '900' }
    })
    await fireEvent.input(within(stations[1]).getByLabelText('Stasjonsbeskrivelse'), {
      target: { value: 'Data som krever bekreftelse' }
    })
    await fireEvent.input(within(stations[1]).getByLabelText('Lengde for rad 1'), {
      target: { value: '300' }
    })
    await fireEvent.change(within(stations[0]).getByLabelText(/Båttype/), {
      target: { value: 'Volt Maria' }
    })
    await importFile(page.container, 'ABXG123456_trends.csv')

    const confirmation = await page.findByRole('dialog')
    expect(confirmation.textContent).toContain('manuelle verdier eller fiskeobservasjoner')
    await fireEvent.click(within(confirmation).getByRole('button', { name: 'Avbryt import' }))
    expect(page.container.querySelectorAll('.stationCard')).toHaveLength(2)
    expect(within(page.container.querySelectorAll('.stationCard')[1])
      .getByLabelText('Stasjonsbeskrivelse').value).toBe('Data som krever bekreftelse')

    await importFile(page.container, 'ABXG123456_trends.csv')
    const secondConfirmation = await page.findByRole('dialog')
    await fireEvent.click(within(secondConfirmation).getByRole('button', {
      name: 'Importer og fjern dataførte stasjoner'
    }))

    await waitFor(() => {
      expect(page.container.querySelectorAll('.stationCard')).toHaveLength(1)
    })
    stations = page.container.querySelectorAll('.stationCard')
    expect(within(stations[0]).getByLabelText(/Dato/).value).toBe('2026-08-15')
    expect(within(stations[0]).getByLabelText(/Volt/).value).toBe('1000')
    expect(within(stations[0]).getByLabelText(/Båttype/).value).toBe('Volt Maria')
    expect(within(stations[0]).getByLabelText('Stasjonsbeskrivelse').value).toBe('Behold denne teksten')
    expect(within(stations[0]).getByLabelText('Lengde for rad 1').value).toBe('250')
    expect(fetchSpy).not.toHaveBeenCalled()

    await fireEvent.click(page.getByRole('button', { name: '+ Legg til stasjon' }))
    expect(page.container.querySelectorAll('.stationCard')).toHaveLength(2)
    await fireEvent.click(page.getAllByRole('button', { name: 'Fjern stasjon' })[1])
    expect(page.container.querySelectorAll('.stationCard')).toHaveLength(1)
  })

  it('highlights empty station fields after station number and boat type are set', async () => {
    const page = render(AddDataPage)
    const station = page.container.querySelector('.stationCard')
    const dateField = within(station).getByLabelText(/Dato/)
    const descriptionField = within(station).getByLabelText('Stasjonsbeskrivelse')
    const stationNumberField = station.querySelector('.fieldGrid .field input[type="number"]')

    expect(dateField.closest('label').classList.contains('missingField')).toBe(false)
    await fireEvent.change(within(station).getByLabelText(/Båttype/), {
      target: { value: 'Cataraft' }
    })

    expect(dateField.closest('label').classList.contains('missingField')).toBe(true)
    expect(descriptionField.closest('label').classList.contains('missingField')).toBe(true)
    expect(stationNumberField.closest('label').classList.contains('missingField')).toBe(false)

    await fireEvent.input(descriptionField, { target: { value: 'Klar' } })
    expect(descriptionField.closest('label').classList.contains('missingField')).toBe(false)
  })

  it('saves map-edited station numbers and coordinates back to the form without changing manual fields', async () => {
    const page = render(AddDataPage)
    const originalStation = page.container.querySelector('.stationCard')

    await fireEvent.input(within(originalStation).getByLabelText('Stasjonsbeskrivelse'), {
      target: { value: 'Behold beskrivelsen' }
    })
    await fireEvent.click(page.getByRole('button', { name: 'Forhåndsvis stasjoner i kart' }))
    const dialog = page.getByRole('dialog')

    await fireEvent.click(within(dialog).getByRole('button', { name: 'Rediger' }))
    await fireEvent.input(within(dialog).getByLabelText('Stasjonsnummer for rad 1'), {
      target: { value: '5' }
    })
    await fireEvent.input(within(dialog).getByLabelText('Klokkeslett for stasjon 5'), {
      target: { value: '10:45' }
    })
    await fireEvent.input(within(dialog).getByLabelText('Start breddegrad for stasjon 5'), {
      target: { value: '61,123456' }
    })
    await fireEvent.input(within(dialog).getByLabelText('Start lengdegrad for stasjon 5'), {
      target: { value: '10,654321' }
    })
    await fireEvent.input(within(dialog).getByLabelText('Stopp breddegrad for stasjon 5'), {
      target: { value: '61,234567' }
    })
    await fireEvent.input(within(dialog).getByLabelText('Stopp lengdegrad for stasjon 5'), {
      target: { value: '10,765432' }
    })
    await fireEvent.input(within(dialog).getByLabelText('Transektlengde for stasjon 5'), {
      target: { value: '260' }
    })
    await fireEvent.input(within(dialog).getByLabelText('Sekunder fisket for stasjon 5'), {
      target: { value: '400' }
    })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Lagre endringer' }))

    const updatedStation = page.container.querySelector('.stationCard')
    expect(within(updatedStation).getByRole('heading', { name: 'Stasjon 5' })).toBeTruthy()
    expect(within(updatedStation).getByLabelText(/Lat start/).value).toBe('61,123456')
    expect(within(updatedStation).getByLabelText(/Long start/).value).toBe('10,654321')
    expect(within(updatedStation).getByLabelText(/Lat stopp/).value).toBe('61,234567')
    expect(within(updatedStation).getByLabelText(/Long stopp/).value).toBe('10,765432')
    expect(within(updatedStation).getByLabelText('Klokkeslett start, time for stasjon 5').value).toBe('10')
    expect(within(updatedStation).getByLabelText('Klokkeslett start, minutt for stasjon 5').value).toBe('45')
    expect(within(updatedStation).getByLabelText(/Transektlengde/).value).toBe('260')
    expect(within(updatedStation).getByLabelText(/Sekunder fisket/).value).toBe('400')
    expect(within(updatedStation).getByLabelText('Stasjonsbeskrivelse').value).toBe('Behold beskrivelsen')
    expect(page.queryByRole('dialog')).toBeNull()
  })

  it('saves reordered station rows with all station and observation data attached', async () => {
    const page = render(AddDataPage)
    await fireEvent.click(page.getByRole('button', { name: '+ Legg til stasjon' }))
    const originalStations = page.container.querySelectorAll('.stationCard')

    await fireEvent.input(within(originalStations[0]).getByLabelText('Stasjonsbeskrivelse'), {
      target: { value: 'Første stasjon' }
    })
    await fireEvent.input(within(originalStations[0]).getByLabelText('Omgang for rad 1'), {
      target: { value: '11' }
    })
    await fireEvent.input(within(originalStations[1]).getByLabelText('Stasjonsbeskrivelse'), {
      target: { value: 'Andre stasjon' }
    })
    await fireEvent.input(within(originalStations[1]).getByLabelText('Omgang for rad 1'), {
      target: { value: '22' }
    })

    await fireEvent.click(page.getByRole('button', { name: 'Forhåndsvis stasjoner i kart' }))
    const dialog = page.getByRole('dialog')
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Rediger' }))
    const dataTransfer = {
      setData: () => {},
      effectAllowed: '',
      dropEffect: ''
    }
    const rows = dialog.querySelectorAll('.stationTable tbody tr')
    await fireEvent.dragStart(within(rows[0]).getByRole('button', {
      name: 'Dra stasjon 1 for å flytte raden'
    }), { dataTransfer })
    await fireEvent.dragOver(rows[1], { dataTransfer })
    await fireEvent.drop(rows[1], { dataTransfer })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Lagre endringer' }))

    const reorderedStations = page.container.querySelectorAll('.stationCard')
    expect(within(reorderedStations[0]).getByRole('heading', { name: 'Stasjon 2' })).toBeTruthy()
    expect(within(reorderedStations[0]).getByLabelText('Stasjonsbeskrivelse').value).toBe('Andre stasjon')
    expect(within(reorderedStations[0]).getByLabelText('Omgang for rad 1').value).toBe('22')
    expect(within(reorderedStations[1]).getByRole('heading', { name: 'Stasjon 1' })).toBeTruthy()
    expect(within(reorderedStations[1]).getByLabelText('Stasjonsbeskrivelse').value).toBe('Første stasjon')
    expect(within(reorderedStations[1]).getByLabelText('Omgang for rad 1').value).toBe('11')
  })

  it('recalculates edited transect length as straight-line endpoint distance', async () => {
    const group = [
      trendsRow(0, '2026-07-01 09:00:00+02:00', { latitude: 61, longitude: 10 }),
      trendsRow(5, '2026-07-01 09:00:05+02:00', { latitude: 61, longitude: 10 }),
      trendsRow(10, '2026-07-01 09:00:10+02:00', { latitude: 61.1, longitude: 10 }),
      trendsRow(15, '2026-07-01 09:00:15+02:00', { latitude: 61, longitude: 10.001 })
    ]
    validateApexCsvFiles.mockResolvedValue({
      trends: group,
      groups: [group],
      warnings: []
    })
    const page = render(AddDataPage)
    await importFile(page.container, 'ABXG123456_trends.csv')

    await waitFor(() => {
      const importedStation = page.container.querySelector('.stationCard')
      expect(within(importedStation).getByLabelText(/Transektlengde/).value).not.toBe('')
    })
    const stationCard = page.container.querySelector('.stationCard')
    const originalLength = Number(within(stationCard).getByLabelText(/Transektlengde/).value)
    await fireEvent.click(page.getByRole('button', { name: 'Forhåndsvis stasjoner i kart' }))
    const dialog = page.getByRole('dialog')
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Rediger' }))
    await fireEvent.input(within(dialog).getByLabelText('Stopp breddegrad for stasjon 1'), {
      target: { value: '61,002' }
    })
    const editedLength = Number(within(dialog).getByLabelText('Transektlengde for stasjon 1').value)
    expect(editedLength).toBeGreaterThan(0)
    expect(editedLength).toBeLessThan(originalLength)
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Lagre endringer' }))

    const updatedStation = page.container.querySelector('.stationCard')
    expect(Number(within(updatedStation).getByLabelText(/Transektlengde/).value)).toBe(editedLength)
    await fireEvent.input(within(updatedStation).getByLabelText(/Long stopp/), {
      target: { value: '10,002' }
    })
    expect(Number(within(updatedStation).getByLabelText(/Transektlengde/).value)).toBeGreaterThan(editedLength)
  })

  it('provides four global controls for river details, station details, observations, and map preview', async () => {
    const page = render(AddDataPage)
    const controls = page.getByRole('group', { name: 'Visning av skjemainformasjon' })

    expect(within(controls).getAllByRole('button')).toHaveLength(4)
    await fireEvent.click(within(controls).getByRole('button', { name: 'Skjul elveinformasjon' }))
    expect(within(controls).getByRole('button', { name: 'Vis elveinformasjon' })).toBeTruthy()
    expect(page.container.querySelector('#river-information-fields .fieldGrid')).toBeNull()

    await fireEvent.click(within(controls).getByRole('button', { name: 'Skjul alle stasjonsdata' }))
    expect(page.container.querySelector('.stationCard .fieldGrid')).toBeNull()
    expect(page.container.querySelector('.stationCard .observationTableWrap')).toBeTruthy()
    await fireEvent.click(within(controls).getByRole('button', { name: 'Vis alle stasjonsdata' }))
    expect(page.container.querySelector('.stationCard .fieldGrid')).toBeTruthy()

    await fireEvent.click(within(controls).getByRole('button', { name: 'Skjul alle fiskeobservasjoner' }))
    expect(page.container.querySelector('.stationCard .observationTableWrap')).toBeNull()
    await fireEvent.click(within(controls).getByRole('button', { name: 'Vis alle fiskeobservasjoner' }))
    expect(page.container.querySelector('.stationCard .observationTableWrap')).toBeTruthy()
  })

  it('collapses station details independently while retaining its observation table', async () => {
    const page = render(AddDataPage)
    const station = page.container.querySelector('.stationCard')

    await fireEvent.click(within(station).getByRole('button', {
      name: 'Skjul stasjonsinformasjon for Stasjon 1'
    }))

    expect(within(station).getByRole('heading', { name: 'Stasjon 1' })).toBeTruthy()
    expect(within(station).queryByLabelText(/Båttype/)).toBeNull()
    expect(within(station).getByRole('heading', {
      name: 'Fiskeobservasjoner for Stasjon 1'
    })).toBeTruthy()
    expect(within(station).getByRole('button', {
      name: 'Vis stasjonsinformasjon for Stasjon 1'
    })).toBeTruthy()
    expect(within(station).getByRole('table')).toBeTruthy()
  })

  it('collapses fish observation tables individually and globally, keeping them grouped by station', async () => {
    const page = render(AddDataPage)
    await fireEvent.click(page.getByRole('button', { name: '+ Legg til stasjon' }))

    const firstStation = page.container.querySelectorAll('.stationCard')[0]
    await fireEvent.click(within(firstStation).getByRole('button', {
      name: 'Skjul fiskeobservasjoner for Stasjon 1'
    }))
    expect(within(firstStation).queryByRole('table')).toBeNull()
    expect(within(firstStation).getByRole('heading', {
      name: 'Fiskeobservasjoner for Stasjon 1'
    })).toBeTruthy()
    await fireEvent.click(within(firstStation).getByRole('button', {
      name: 'Vis fiskeobservasjoner for Stasjon 1'
    }))

    await fireEvent.click(page.getByRole('button', { name: 'Skjul alle fiskeobservasjoner' }))
    const stationCards = page.container.querySelectorAll('.stationCard')
    expect([...stationCards].every(card => card.querySelector('.observationTableWrap') === null)).toBe(true)
    expect([...stationCards].map(card => card.querySelector('h4').textContent)).toEqual([
      'Fiskeobservasjoner for Stasjon 1',
      'Fiskeobservasjoner for Stasjon 2'
    ])

    await fireEvent.click(page.getByRole('button', { name: 'Vis alle fiskeobservasjoner' }))
    expect([...page.container.querySelectorAll('.stationCard .observationTableWrap')]).toHaveLength(2)
  })

  it('keeps observation tables directly with their collapsed station heading when all station details are hidden', async () => {
    const page = render(AddDataPage)
    await fireEvent.click(page.getByRole('button', { name: '+ Legg til stasjon' }))
    await fireEvent.click(page.getByRole('button', { name: 'Skjul alle stasjonsdata' }))

    const stationCards = [...page.container.querySelectorAll('.stationCard')]
    expect(stationCards).toHaveLength(2)
    for (const [index, station] of stationCards.entries()) {
      expect(station.querySelector('.fieldGrid')).toBeNull()
      expect(station.querySelector('.observationTableWrap')).toBeTruthy()
      expect(station.querySelector('h3').textContent).toBe(`Stasjon ${index + 1}`)
      expect(station.querySelector('h4').textContent).toBe(`Fiskeobservasjoner for Stasjon ${index + 1}`)
    }
  })

  it('shows the publish action at the bottom but keeps it disabled until backend integration exists', () => {
    const page = render(AddDataPage)
    const publishButton = page.getByRole('button', { name: 'Publiser data' })

    expect(publishButton.disabled).toBe(true)
    expect(publishButton.closest('.formFooter')).toBeTruthy()
    expect(publishButton.getAttribute('aria-describedby')).toBe('publish-disabled-note')
    expect(page.getByText('Publisering til server og database er ikke koblet til ennå.')).toBeTruthy()
    expect(publishButton.getAttribute('title')).toContain('backend')
  })
})
