/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Modal from './Modal.svelte'

describe('Modal', () => {
  afterEach(() => cleanup())

  it('renders an accessible labelled modal dialog', () => {
    const { getByRole } = render(Modal, { props: { labelledBy: 'dialog-title' } })

    expect(getByRole('dialog').getAttribute('aria-modal')).toBe('true')
    expect(getByRole('dialog').getAttribute('aria-labelledby')).toBe('dialog-title')
  })

  it('uses a fallback accessible label when no title id is supplied', () => {
    const { getByRole } = render(Modal)

    expect(getByRole('dialog').getAttribute('aria-label')).toBe('Dialog')
  })

  it('supports an extra-large dialog sized to the available viewport', () => {
    const { getByRole } = render(Modal, { props: { extraLarge: true } })
    const dialog = getByRole('dialog')

    expect(dialog.classList.contains('extraLarge')).toBe(true)
    expect(dialog.getAttribute('style')).toContain('min(1600px, calc(100vw - 16px))')
    expect(dialog.getAttribute('style')).toContain('min(1200px, calc(100vh - 16px))')
  })

  it('dispatches a close event when the close button is clicked', async () => {
    const { component, getByRole } = render(Modal)
    const onClose = vi.fn()
    component.$on('close', onClose)

    await fireEvent.click(getByRole('button', { name: 'Lukk dialog' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the modal open on Enter and closes it on Escape', async () => {
    const { component, getByRole } = render(Modal)
    const onClose = vi.fn()
    component.$on('close', onClose)

    await fireEvent.keyDown(getByRole('dialog'), { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()

    await fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
