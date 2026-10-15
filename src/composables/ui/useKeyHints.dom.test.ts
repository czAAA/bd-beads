import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browserDevicePreferences } from '../../services/devicePreferences'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import { resetKeyHintsDevice, useKeyHints } from './useKeyHints'

const QUERY = '(any-pointer: fine) and (any-hover: hover)'

function onDevice(keyboardLikely: boolean) {
  const media = fakeMatchMedia({ [QUERY]: keyboardLikely })
  vi.stubGlobal('matchMedia', media.matchMedia)
  window.matchMedia = media.matchMedia
  useKeyHints() // starts watching
  resetKeyHintsDevice()
  return media
}

function press(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', init))
}

describe('useKeyHints (ticket 438)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllGlobals()
    resetKeyHintsDevice()
  })

  it('shows chips on a device with a hovering fine pointer', () => {
    onDevice(true)
    expect(useKeyHints().shown.value).toBe(true)
  })

  it('hides them on a touch-only device, and soft-keyboard typing does not bring them back', () => {
    onDevice(false)
    const { shown } = useKeyHints()
    press({ key: 'a' })
    expect(shown.value).toBe(false)
  })

  it.each([
    { key: 'Tab' },
    { key: 'Escape' },
    { key: 'ArrowLeft' },
    { key: 'z', ctrlKey: true },
    { key: 'z', metaKey: true },
  ])('brings them back for the session after a real key $key, and a touch does not hide them again', (init) => {
    const media = onDevice(false)
    const { shown } = useKeyHints()
    press(init)
    expect(shown.value).toBe(true)
    media.set(QUERY, false)
    expect(shown.value).toBe(true)
    expect(localStorage.length).toBe(0)
  })

  it('keeps an explicit choice on the device: on shows without a keyboard, off hides even after a keydown', () => {
    onDevice(false)
    useKeyHints().setShown(true)
    expect(useKeyHints().shown.value).toBe(true)
    expect(localStorage.getItem('bd-beads:key-hints')).toBe('on')

    useKeyHints().setShown(false)
    press({ key: 'Tab' })
    expect(useKeyHints().shown.value).toBe(false)
    expect(localStorage.getItem('bd-beads:key-hints')).toBe('off')
  })

  it('reads the stored choice after a reload', () => {
    onDevice(true)
    localStorage.setItem('bd-beads:key-hints', 'off')
    browserDevicePreferences.forget()
    expect(useKeyHints().shown.value).toBe(false)
  })
})
