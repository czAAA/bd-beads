import { frameIdIn } from '../../testUtils/frameId'
import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import AppDialogs from './AppDialogs.vue'
import { mountShellParts } from '../../testUtils/shellHost'
import { seedProject } from '../../testUtils/seedProject'
import { withLayers } from '../../testUtils/layerFields'
import { saveProjects } from '../../services/libraryStore'
import { frameOf } from '../../domain/layerRecord'
import { moveToRow, rowProgressOf } from '../../domain/rowProgress'

/** The dialogs as the registry shows them, under the real wiring (ticket 0618). Each dialog's text is in ConfirmModal
 * and its fit in dialogsFit; which question a flow asks, and what its answers do, in that flow's test; a panel control
 * reaching its dialog in AppPanels.test. */

const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

describe('AppDialogs', () => {
  it('shows one dialog at a time: one asked while another shows waits, and shows once that one is answered', async () => {
    const { wrapper, dialogRegistry } = mountShellParts(AppDialogs)
    dialogRegistry.flag('delete-all').value = true
    dialogRegistry.flag('reset-progress').value = true
    await flushPromises()
    expect(wrapper.findAll('.app-modal')).toHaveLength(1)
    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)

    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reset-progress-modal"]').exists()).toBe(true)
  })

  it('answers Turn the Frame? with its three buttons: start over, keep the rows, Cancel (ticket 1184)', async () => {
    saveProjects([moveToRow(seedProject(15, 30), 2, frameIdIn(seedProject(15, 30)))])
    const { wrapper, canvas, dialogs } = mountShellParts(AppDialogs)
    const before = dialogs.activeProject.value!
    const press = async (button: string) => {
      canvas.onRotateFrame()
      await flushPromises()
      expect(wrapper.get('[data-testid="rotate-frame-modal"]').text()).toContain('Keep the 2 rows')
      await wrapper.get(`[data-testid="confirm-modal-${button}"]`).trigger('click')
    }
    await press('cancel')
    expect(dialogs.activeProject.value).toBe(before)
    await press('extra')
    expect(rowProgressOf(dialogs.activeProject.value!, frameIdIn(dialogs.activeProject.value!))).toEqual({ way: 'down' })
    expect(frameOf(dialogs.activeProject.value!)?.quarterTurns).toBe(1)
  })

  it('answers Change to Brick stitch? by keeping the rows on its confirm (ticket 1184)', async () => {
    saveProjects([moveToRow(seedProject(15, 30), 2, frameIdIn(seedProject(15, 30)))])
    const { wrapper, canvas, dialogs } = mountShellParts(AppDialogs)
    canvas.onSetFrameTechnique('brick')
    await flushPromises()
    expect(wrapper.get('[data-testid="technique-change-modal"]').text()).toContain('Start over for Brick stitch')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(frameOf(dialogs.activeProject.value!)?.technique).toBe('brick')
    expect(rowProgressOf(dialogs.activeProject.value!, frameIdIn(dialogs.activeProject.value!))).toEqual({ way: 'down', down: 2 })
  })

  it('holds the keyboard shortcuts from the moment any dialog is asked, before it has drawn', async () => {
    saveProjects([withLayers(seedProject(15, 30), { beads: { 90: { 90: '#ff0000' } } })]) // a bead, so R has something to number (tickets 0921, 1012)
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
