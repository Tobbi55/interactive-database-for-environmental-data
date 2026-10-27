import { cleanup, render, fireEvent } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import SpeciesInput from './SpeciesInput.svelte'

/**
 * @vitest-environment jsdom
 */

afterEach(cleanup)

describe('SpeciesInput', () => {
  it('adds a selected species and removes it from the available options', async () => {
    const { getByRole, getByText, queryByRole } = render(SpeciesInput, {
      props: {
        selectableSpecies: ['test species'],
        customSpecies: [],
        chooseAll: false
      }
    })

    const select = getByRole('combobox', { name: 'Velg arter:' })
    await fireEvent.change(select, { target: { value: 'test species' } })

    expect(getByText('Test species')).toBeTruthy()
    expect(queryByRole('option', { name: 'Test species' })).toBeNull()
  })
})
