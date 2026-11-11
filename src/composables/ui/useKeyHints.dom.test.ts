import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browserDevicePreferences } from '../../services/devicePreferences'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import { resetKeyHintsDevice, useHelpDevice, useKeyHints } from './useKeyHints'

const QUERY = '(any-pointer: fine) and (any-hover: hover)'
const TOUCH = '(pointer: coarse)'

function onDevice(keyboardLikely: boolean, touch = false) {
  const media = fakeMatchMedia({ [QUERY]: keyboardLikely, [TOUCH]: touch })
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
    expect(localStorage.getItem('openbeads:key-hints')).toBe('on')

    useKeyHints().setShown(false)
    press({ key: 'Tab' })
    expect(useKeyHints().shown.value).toBe(false)
    expect(localStorage.getItem('openbeads:key-hints')).toBe('off')
  })

  it('reads the stored choice after a reload', () => {
    onDevice(true)
    localStorage.setItem('openbeads:key-hints', 'off')
    browserDevicePreferences.forget()
    expect(useKeyHints().shown.value).toBe(false)
  })

  it('hides them on a device led by touch even when it also has a fine hovering pointer, such as an iPad with a Pencil (ticket 0846)', () => {
    onDevice(true, true)
    const { shown } = useKeyHints()
    expect(shown.value).toBe(false)
    press({ key: 'Escape' })
    expect(shown.value).toBe(true)
  })
})

describe('useHelpDevice (ticket 0846)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetKeyHintsDevice()
  })

  function onAgent(userAgent: string) {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  }

  it('speaks to touch while a finger leads and no keyboard has shown itself, and to its keyboard once one has', () => {
    onAgent('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')
    onDevice(false, true)
    const { device } = useHelpDevice()
    expect(device.value).toBe('touch')
    press({ key: 'Tab' })
    expect(device.value).toBe('apple')
  })

  it('writes the modifier as ⌘ on an Apple device and Ctrl elsewhere', () => {
    onAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
    onDevice(true)
    const apple = useHelpDevice()
    expect([apple.device.value, apple.modKey(), apple.modKey('V')]).toEqual(['apple', '⌘', '⌘V'])

    onAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    const other = useHelpDevice()
    expect([other.device.value, other.modKey(), other.modKey('V')]).toEqual(['other', 'Ctrl', 'Ctrl+V'])
  })

  it('follows the shortcuts switch: turned on, a touch device gets the key words', () => {
    onAgent('Mozilla/5.0 (Windows NT 10.0)')
    onDevice(false, true)
    useKeyHints().setShown(true)
    expect(useHelpDevice().device.value).toBe('other')
  })
})
