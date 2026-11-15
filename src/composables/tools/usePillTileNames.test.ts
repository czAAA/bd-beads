import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { en } from '../../i18n/en'
import { createDevicePreferences, type PreferenceStorage } from '../../services/devicePreferences'
import { usePillTileNames } from './usePillTileNames'

/** The first-tap names over a storage of their own, by touch or by mouse. */
function setup(touch: boolean, data = new Map<string, string>()) {
  const storage: PreferenceStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) }
  const showToast = vi.fn()
  const names = usePillTileNames({ touch: ref(touch), showToast, messages: () => en, preferences: createDevicePreferences(storage) })
  return { ...names, showToast, data }
}

describe('usePillTileNames (ticket 0927)', () => {
  it('on touch says a tile’s name and Tooltip line in the toast the first time it is tapped, and not the second', () => {
    const { onPillTileTap, showToast } = setup(true)

    onPillTileTap('fill')
    onPillTileTap('fill')

    expect(showToast.mock.calls).toEqual([['pill-tile-name', 'Fill: Tap an area to fill it with the chosen color.', 'info']])
  })

  it('names each tile once, the Mirror and Paste too, with the touch line where the tile has one', () => {
    const { onPillTileTap, showToast } = setup(true)

    onPillTileTap('mirror')
    onPillTileTap('paste')

    expect(showToast.mock.calls.map(([, text]) => text)).toEqual([`${en.mirror.title}: ${en.tooltips.mirror}`, `${en.tools.pasteLabel}: ${en.tooltips.pasteToolTouch}`])
  })

  it('remembers the named tiles on the device, so a later visit says them no more', () => {
    const first = setup(true)
    first.onPillTileTap('paint')

    const later = setup(true, first.data)
    later.onPillTileTap('paint')
    later.onPillTileTap('hand')

    expect(later.showToast.mock.calls.map(([, text]) => text)).toEqual([`${en.tools.handLabel}: ${en.tooltips.hand}`])
  })

  it('never says a name with a mouse, and keeps the tile unnamed for touch', () => {
    const { onPillTileTap, showToast, data } = setup(false)

    onPillTileTap('paint')

    expect(showToast).not.toHaveBeenCalled()
    expect(data.size).toBe(0)
  })
})
