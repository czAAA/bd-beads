import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { en } from '../../i18n/en'
import { useArmedToolToasts } from './useArmedToolToasts'

function setup(touch: boolean) {
  const modes = { mirrorMarking: ref(false), mirrorOn: ref(false), picking: ref(false), pasteArmed: ref(false) }
  const showToast = vi.fn()
  const dismissToast = vi.fn()
  useArmedToolToasts({
    touch: ref(touch),
    showToast,
    dismissToast,
    messages: () => en,
    mirrorMarking: () => modes.mirrorMarking.value,
    mirrorOn: () => modes.mirrorOn.value,
    picking: () => modes.picking.value,
    pasteArmed: () => modes.pasteArmed.value,
  })
  return { modes, showToast, dismissToast }
}

describe('useArmedToolToasts (ticket 0845)', () => {
  it('on touch says what each armed mode waits for, and takes the toast away when the mode ends', async () => {
    const { modes, showToast, dismissToast } = setup(true)

    modes.mirrorMarking.value = true
    modes.pasteArmed.value = true
    modes.picking.value = true
    await nextTick()
    expect(showToast.mock.calls.sort()).toEqual([
      ['mirror-armed', 'Drag over the Canvas to mark the area to mirror.', 'info'],
      ['paste-armed', 'Tap the Canvas to place the copy. Pick a tool to stop.', 'info'],
      ['pick-armed', 'Tap a bead to use its color.', 'info'],
    ])

    modes.mirrorOn.value = true
    modes.pasteArmed.value = false
    modes.picking.value = false
    await nextTick()
    expect(dismissToast.mock.calls.map(([id]) => id).sort()).toEqual(['mirror-armed', 'paste-armed', 'pick-armed'])
  })

  it('says nothing on entering Mirror mode while the Mirror already has its Area (the whole Frame\'s, say)', async () => {
    const { modes, showToast } = setup(true)
    modes.mirrorOn.value = true
    modes.mirrorMarking.value = true
    await nextTick()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('shows no toast with a mouse: its cursor says the mode', async () => {
    const { modes, showToast } = setup(false)
    modes.mirrorMarking.value = true
    modes.pasteArmed.value = true
    modes.picking.value = true
    await nextTick()
    expect(showToast).not.toHaveBeenCalled()
  })
})
