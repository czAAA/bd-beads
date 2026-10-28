import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { browserDevicePreferences } from '../services/devicePreferences'
import { resetKeyHintsDevice, useKeyHints } from '../composables/ui/useKeyHints'
import { fakeMatchMedia } from './fakeMatchMedia'
import { resetSharedPage, strictlyIncreasing } from './sharedPage'

describe('the shared page each page test file starts on (ticket 0608)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('starts in English with key chips shown, whatever the file before left', () => {
    // What a file left: a Russian page on a touch device, its fake assigned straight onto window.
    localStorage.setItem('openbeads:locale', 'ru')
    document.documentElement.lang = 'ru'
    window.matchMedia = fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia

    resetSharedPage()
    browserDevicePreferences.forget()
    resetKeyHintsDevice()

    expect(browserDevicePreferences.get('locale').value).toBe('en')
    expect(document.documentElement.hasAttribute('lang')).toBe(false)
    expect(useKeyHints().shown.value).toBe(true)
  })

  // Vue drops an event stamped no later than its listener was attached, and a listener that sees it first (here a
  // capture one) stamps it. A warm worker mounts and clicks within one millisecond, so the click got lost.
  it('keeps a click made in the same millisecond as the mount, though a capture listener stamps it first', () => {
    vi.spyOn(Date, 'now').mockImplementation(strictlyIncreasing(() => 1_000))
    const clicks = ref(0)
    const Wrapped = defineComponent(() => () => h('span', { onClickCapture: () => {} }, [h('button', { onClick: () => clicks.value++ })]))
    mount(Wrapped, { attachTo: document.body })
    document.querySelector('button')!.click()
    expect(clicks.value).toBe(1)
  })

  it('has a clock that never reads the same twice', () => {
    const first = Date.now()
    expect(Date.now()).toBeGreaterThan(first)
  })
})

describe('strictlyIncreasing', () => {
  it('moves on by a millisecond each read while the clock it follows stands still', () => {
    const now = strictlyIncreasing(() => 1_000)
    expect([now(), now(), now()]).toEqual([1_000, 1_001, 1_002])
  })

  it('catches up with the clock it follows once that moves ahead', () => {
    let clock = 1_000
    const now = strictlyIncreasing(() => clock)
    now()
    now()
    clock = 5_000
    expect(now()).toBe(5_000)
  })
})
