import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolPill from '../tools/ToolPill.vue'
import CanvasHint from '../canvas/CanvasHint.vue'
import AppTooltip from './AppTooltip.vue'
import { resetKeyHintsDevice, useKeyHints } from '../../composables/ui/useKeyHints'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'

const PILL_PROPS = { activeTool: 'paint', position: 'bottom', recentsInPill: [], popoverOpen: false } as const
const QUERY = '(any-pointer: fine) and (any-hover: hover)'

function onDevice(keyboardLikely: boolean, touch = false) {
  const media = fakeMatchMedia({ [QUERY]: keyboardLikely, '(pointer: coarse)': touch })
  window.matchMedia = media.matchMedia
  useKeyHints()
  resetKeyHintsDevice()
}

describe('hotkey chips follow the device (ticket 438)', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('openbeads:locale', 'en')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    resetKeyHintsDevice()
    document.body.innerHTML = ''
  })

  it('shows the Tool pill badge, the Canvas hint and the Tooltip key where a keyboard is likely', () => {
    onDevice(true)
    expect(mount(ToolPill, { props: PILL_PROPS }).find('.icon-btn__key').exists()).toBe(true)
    expect(mount(CanvasHint).find('.canvas-hint__key').exists()).toBe(true)
    const tooltip = mount(AppTooltip, { props: { name: 'Fill', hotkey: '2' }, slots: { default: '<button>x</button>' }, attachTo: document.body })
    expect(tooltip.find('.app-tooltip__key').text()).toBe('2')
  })

  it('shows none of them on a touch-only device until a real key is pressed', async () => {
    onDevice(false, true)
    const dock = mount(ToolPill, { props: PILL_PROPS })
    const hint = mount(CanvasHint)
    const tooltip = mount(AppTooltip, { props: { name: 'Fill', hotkey: '2' }, slots: { default: '<button>x</button>' }, attachTo: document.body })
    expect(dock.find('.icon-btn__key').exists()).toBe(false)
    expect(hint.find('.canvas-hint__key').exists()).toBe(false)
    expect(tooltip.find('.app-tooltip__key').exists()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    await dock.vm.$nextTick()
    expect(dock.find('.icon-btn__key').exists()).toBe(true)
  })

  it('on touch the Canvas hint speaks of fingers and names no key, and the pill shows no digits (ticket 0846)', () => {
    onDevice(true, true)
    const dock = mount(ToolPill, { props: PILL_PROPS })
    const hint = mount(CanvasHint)
    expect(dock.find('.icon-btn__key').exists()).toBe(false)
    expect(hint.findAll('span').map((part) => part.text())).toEqual(['two fingers to move', '·', 'pinch to zoom'])
    expect(hint.find('kbd').exists()).toBe(false)
  })
})
