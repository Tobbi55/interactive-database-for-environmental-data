import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import Filter from './Filter.svelte'
import { DATATYPE_STATION } from '../constants/dataTypes'

/**
 * @vitest-environment jsdom
 */

afterEach(cleanup)

describe('Filter', () => {
  it('renders child components', () => {
    const { getByText } = render(Filter, { props: { selectableSpecies: [] } })

    // Checking if the child components are rendered
    expect(getByText('Type data')).not.toBeNull()
    expect(getByText('Dato')).not.toBeNull()
    expect(getByText('Art')).not.toBeNull()
  })

  it('shows the separate station colors option only for station data', async () => {
    const { getByRole, queryByRole } = render(Filter, {
      props: { selectableSpecies: [] }
    })

    expect(queryByRole('checkbox', { name: /Vis stasjonsdata med separate farger/ })).toBeNull()

    await fireEvent.click(getByRole('radio', { name: /Stasjonsdata/ }))

    expect(getByRole('checkbox', { name: /Vis stasjonsdata med separate farger/ })).not.toBeNull()
  })

  it('accepts the setting as an input in station data mode', () => {
    const { getByRole } = render(Filter, {
      props: {
        selectableSpecies: [],
        dataType: DATATYPE_STATION,
        showSeparateStationColors: true
      }
    })

    expect(getByRole('checkbox', { name: /Vis stasjonsdata med separate farger/ }).checked).toBe(true)
  })
})
