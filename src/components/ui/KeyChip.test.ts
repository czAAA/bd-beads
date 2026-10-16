import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDock from '../tools/AppDock.vue'
import CanvasHint from '../canvas/CanvasHint.vue'
import AppTooltip from './AppTooltip.vue'
import { resetKeyHintsDevice, useKeyHints } from '../../composables/ui/useKeyHints'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'

const QUERY = '(any-pointer: fine) and (any-hover: hover)'

function onDevice(keyboardLikely: boolean) {
  const media = fakeMatchMedia({ [QUERY]: keyboardLikely })
  window.matchMedia = media.matchMedia
  useKeyHints()
  resetKeyHintsDevice()
}

describe('hotkey chips follow the device (ticket 438)', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('bd-beads:locale', 'en')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    resetKeyHintsDevice()
    document.body.innerHTML = ''
  })

  it('shows the Dock badge, the Canvas hint and the Tooltip key where a keyboard is likely', () => {
    onDevice(true)
    expect(mount(AppDock, { props: { activeTool: 'paint', openSheet: null } }).find('.icon-btn__key').exists()).toBe(true)
    expect(mount(CanvasHint).find('.canvas-hint__key').exists()).toBe(true)
    const tooltip = mount(AppTooltip, { props: { name: 'Fill', hotkey: '2' }, slots: { default: '<button>x</button>' }, attachTo: document.body })
    expect(tooltip.find('.app-tooltip__key').text()).toBe('2')
  })

  it('shows none of them on a touch-only device until a real key is pressed', async () => {
    onDevice(false)
    const dock = mount(AppDock, { props: { activeTool: 'paint', openSheet: null } })
    const hint = mount(CanvasHint)
    const tooltip = mount(AppTooltip, { props: { name: 'Fill', hotkey: '2' }, slots: { default: '<button>x</button>' }, attachTo: document.body })
    expect(dock.find('.icon-btn__key').exists()).toBe(false)
    expect(hint.find('.canvas-hint__key').exists()).toBe(false)
    expect(tooltip.find('.app-tooltip__key').exists()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    await dock.vm.$nextTick()
    expect(dock.find('.icon-btn__key').exists()).toBe(true)
  })
})
