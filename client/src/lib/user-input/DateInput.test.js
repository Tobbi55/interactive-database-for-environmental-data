import { cleanup, render, fireEvent } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import DateInput from './DateInput.svelte'

/**
 * @vitest-environment jsdom
 */

afterEach(cleanup)

describe('DateInput', () => {
  it('shows date fields when enabled and clears them when disabled', async () => {
    const { getByRole, getByLabelText, queryByLabelText } = render(DateInput, {
      props: {
        selectedStartDate: '',
        selectedEndDate: ''
      }
    })
    const toggle = getByRole('checkbox', { name: 'Bruk datofilter' })

    expect(queryByLabelText('Fra')).toBeNull()
    await fireEvent.click(toggle)

    const startDateInput = getByLabelText('Fra')
    const endDateInput = getByLabelText('Til')
    await fireEvent.input(startDateInput, { target: { value: '2022-01-01' } })
    await fireEvent.input(endDateInput, { target: { value: '2022-12-31' } })
    expect(startDateInput.value).toBe('2022-01-01')
    expect(endDateInput.value).toBe('2022-12-31')

    await fireEvent.click(toggle)
    expect(queryByLabelText('Fra')).toBeNull()

    await fireEvent.click(toggle)
    expect(getByLabelText('Fra').value).toBe('')
    expect(getByLabelText('Til').value).toBe('')
  })
})
