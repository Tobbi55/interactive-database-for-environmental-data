/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import StationMapPreview from './StationMapPreview.svelte'

const station = {
  key: 17,
  number: '7',
  startTime: '09:20',
  startLat: '61,25',
  startLong: '10,42',
  endLat: '61,26',
  endLong: '10,43',
  transectLength: '250',
  secondsFished: '300',
  description: 'Bevares',
  observations: [{ key: 1, species: 'ørret' }]
}

describe('StationMapPreview', () => {
  afterEach(cleanup)

  it('shows numbered station rows and summary fields without fish data', () => {
    const { getByText, queryByText } = render(StationMapPreview, {
      props: { stations: [station] }
    })

    expect(getByText('Stasjon 7')).toBeTruthy()
    expect(getByText('09:20')).toBeTruthy()
    expect(getByText('250 m')).toBeTruthy()
    expect(getByText('300')).toBeTruthy()
    expect(queryByText('ørret')).toBeNull()
  })

  it('starts with an even split and lets users resize the map and table', async () => {
    const { container, getByRole } = render(StationMapPreview, {
      props: { stations: [station] }
    })
    const splitter = getByRole('slider', { name: 'Juster høyde mellom kart og tabell' })
    const layout = container.querySelector('.mapTableLayout')
    const mapPane = container.querySelector('.mapPane')
    const tablePane = container.querySelector('.stationTableWrap')
    layout.getBoundingClientRect = () => ({
      top: 100,
      bottom: 500,
      height: 400,
      left: 0,
      right: 600,
      width: 600,
      x: 0,
      y: 100,
      toJSON: () => {}
    })

    expect(splitter.getAttribute('aria-valuenow')).toBe('50')
    expect(mapPane.style.flexGrow).toBe('0.5')
    expect(tablePane.style.flexGrow).toBe('0.5')

    await fireEvent(splitter, new MouseEvent('pointerdown', {
      bubbles: true,
      clientY: 310
    }))
    await fireEvent(window, new MouseEvent('pointermove', {
      bubbles: true,
      clientY: 338
    }))
    expect(splitter.getAttribute('aria-valuenow')).toBe('60')
    expect(mapPane.style.flexGrow).toBe('0.6')
    expect(tablePane.style.flexGrow).toBe('0.4')
    await fireEvent(window, new MouseEvent('pointerup', { bubbles: true }))

    await fireEvent.keyDown(splitter, { key: 'ArrowUp' })
    expect(splitter.getAttribute('aria-valuenow')).toBe('55')
  })

  it('saves edited station numbers and coordinates by stable station key', async () => {
    const { component, getByLabelText, getByRole } = render(StationMapPreview, {
      props: { stations: [station] }
    })
    let saved
    component.$on('save', event => { saved = event.detail })

    await fireEvent.click(getByRole('button', { name: 'Rediger' }))
    await fireEvent.input(getByLabelText('Stasjonsnummer for rad 1'), {
      target: { value: '9' }
    })
    await fireEvent.input(getByLabelText('Klokkeslett for stasjon 9'), {
      target: { value: '10:45' }
    })
    await fireEvent.input(getByLabelText('Start breddegrad for stasjon 9'), {
      target: { value: '61,123457' }
    })
    await fireEvent.input(getByLabelText('Start lengdegrad for stasjon 9'), {
      target: { value: '10,765432' }
    })
    await fireEvent.input(getByLabelText('Transektlengde for stasjon 9'), {
      target: { value: '260' }
    })
    await fireEvent.input(getByLabelText('Sekunder fisket for stasjon 9'), {
      target: { value: '400' }
    })
    await fireEvent.click(getByRole('button', { name: 'Lagre endringer' }))

    expect(saved).toEqual({
      stations: [{
        key: 17,
        number: '9',
        startTime: '10:45',
        startLat: '61,123457',
        startLong: '10,765432',
        endLat: '61,26',
        endLong: '10,43',
        transectLength: '260',
        secondsFished: '400'
      }]
    })
  })

  it('recalculates transect length only between endpoints when an endpoint moves', async () => {
    const { getByLabelText, getByRole } = render(StationMapPreview, {
      props: { stations: [station] }
    })

    await fireEvent.click(getByRole('button', { name: 'Rediger' }))
    await fireEvent.input(getByLabelText('Stopp breddegrad for stasjon 7'), {
      target: { value: '61,27' }
    })

    expect(Number(getByLabelText('Transektlengde for stasjon 7').value)).toBe(2287)
  })

  it('reorders complete station drafts by dragging their row handle', async () => {
    const secondStation = {
      ...station,
      key: 18,
      number: '8',
      startTime: '10:20',
      startLat: '60,1',
      startLong: '9,2',
      endLat: '60,2',
      endLong: '9,3',
      transectLength: '500',
      secondsFished: '600'
    }
    const { component, container, getByLabelText, getByRole } = render(StationMapPreview, {
      props: { stations: [station, secondStation] }
    })
    let saved
    component.$on('save', event => { saved = event.detail })

    await fireEvent.click(getByRole('button', { name: 'Rediger' }))
    const dataTransfer = {
      setData: () => {},
      effectAllowed: '',
      dropEffect: ''
    }
    const rows = container.querySelectorAll('.stationTable tbody tr')
    await fireEvent.dragStart(getByRole('button', { name: 'Dra stasjon 7 for å flytte raden' }), {
      dataTransfer
    })
    await fireEvent.dragOver(rows[1], { dataTransfer })
    await fireEvent.drop(rows[1], { dataTransfer })

    expect(getByLabelText('Stasjonsnummer for rad 1').value).toBe('8')
    expect(getByLabelText('Klokkeslett for stasjon 8').value).toBe('10:20')
    expect(getByLabelText('Start breddegrad for stasjon 8').value).toBe('60,1')

    await fireEvent.click(getByRole('button', { name: 'Lagre endringer' }))
    expect(saved.stations.map(({ key }) => key)).toEqual([18, 17])
    expect(saved.stations[0]).toMatchObject({
      number: '8',
      startTime: '10:20',
      startLat: '60,1',
      transectLength: '500',
      secondsFished: '600'
    })
  })

  it('clears transect length when the station lacks a valid endpoint', async () => {
    const stationWithMissingEndpoint = { ...station, endLong: '' }
    const { component, container, getByLabelText, getByRole } = render(StationMapPreview, {
      props: { stations: [stationWithMissingEndpoint] }
    })
    let saved
    component.$on('save', event => { saved = event.detail })
    expect(container.querySelector('.stationTable tbody tr td:nth-child(5)').textContent.trim()).toBe('—')

    await fireEvent.click(getByRole('button', { name: 'Rediger' }))
    expect(getByLabelText('Transektlengde for stasjon 7').value).toBe('')
    await fireEvent.click(getByRole('button', { name: 'Lagre endringer' }))

    expect(saved.stations[0].transectLength).toBe('')
  })

  it('clears an existing transect length when an endpoint is edited to be incomplete', async () => {
    const { component, getByLabelText, getByRole } = render(StationMapPreview, {
      props: { stations: [station] }
    })
    let saved
    component.$on('save', event => { saved = event.detail })

    await fireEvent.click(getByRole('button', { name: 'Rediger' }))
    await fireEvent.input(getByLabelText('Stopp lengdegrad for stasjon 7'), {
      target: { value: '' }
    })
    expect(getByLabelText('Transektlengde for stasjon 7').value).toBe('')
    await fireEvent.click(getByRole('button', { name: 'Lagre endringer' }))

    expect(saved.stations[0].transectLength).toBe('')
  })

  it('blocks duplicate station numbers and discards edits when cancelled', async () => {
    const { component, getByLabelText, getByRole, getByText, queryByRole } = render(StationMapPreview, {
      props: {
        stations: [
          station,
          { ...station, key: 18, number: '8', startLat: '61,3', endLat: '61,4' }
        ]
      }
    })
    let saveCount = 0
    component.$on('save', () => { saveCount += 1 })

    await fireEvent.click(getByRole('button', { name: 'Rediger' }))
    await fireEvent.input(getByLabelText('Stasjonsnummer for rad 2'), {
      target: { value: '7' }
    })
    await fireEvent.click(getByRole('button', { name: 'Lagre endringer' }))
    expect(getByRole('alert').textContent).toContain('Stasjonsnummer 7 er brukt flere ganger.')
    expect(saveCount).toBe(0)

    await fireEvent.click(getByRole('button', { name: 'Avbryt redigering' }))
    expect(getByText('Stasjon 8')).toBeTruthy()
    expect(queryByRole('button', { name: 'Lagre endringer' })).toBeNull()
  })
})
