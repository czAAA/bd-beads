import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import AppDialogs from './AppDialogs.vue'
import { mountShellParts } from '../../testUtils/shellHost'

/** The dialogs as the registry shows them, under the real wiring (ticket 0618). Each dialog's text is in ConfirmModal
 * and its fit in dialogsFit; which question a flow asks, and what its answers do, in that flow's test; a panel control
 * reaching its dialog in AppPanels.test. */

const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

describe('AppDialogs', () => {
  it('shows one dialog at a time: one asked while another shows waits, and shows once that one is answered', async () => {
    const { wrapper, dialogRegistry } = mountShellParts(AppDialogs)
    dialogRegistry.flag('delete-all').value = true
    dialogRegistry.flag('keep-note').value = true
    await flushPromises()
    expect(wrapper.findAll('.app-modal')).toHaveLength(1)
    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)

    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="keep-note-modal"]').exists()).toBe(true)
  })

  it('holds the keyboard shortcuts from the moment any dialog is asked, before it has drawn', async () => {
    const { canvas, dialogRegistry } = mountShellParts(AppDialogs)
    const rulers = canvas.showRulers.value
    dialogRegistry.flag('reset-progress').value = true
    pressKey('r')
    expect(canvas.showRulers.value).toBe(rulers)

    dialogRegistry.flag('reset-progress').value = false
    await flushPromises()
    pressKey('r')
    expect(canvas.showRulers.value).toBe(!rulers)
  })
})
