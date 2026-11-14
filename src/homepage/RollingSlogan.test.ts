import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { fakeMatchMedia } from '../testUtils/fakeMatchMedia'
import RollingSlogan from './RollingSlogan.vue'
import { SLOGAN_HOLD_MS, SLOGAN_ROLL_MS, SLOGAN_WORDS } from './slogan'

function slogan() {
  return mount(RollingSlogan, { attachTo: document.body })
}
const rolling = (w: ReturnType<typeof slogan>) =>
  w.get('[data-testid="slogan-column"]').classes().includes('slogan__column--rolling')

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: hidden,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  setHidden(false)
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('RollingSlogan', () => {
  it('reads "openbeads" to a screen reader, with the rolling words hidden', () => {
    const wrapper = slogan()
    // An image of the name: a span with no role may not carry a label (ticket 0856).
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('openbeads')
    expect(wrapper.get('.slogan__slot').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.slogan__open').text()).toBe('open')
  })

  it('holds "openbeads" on arrival, rolls once back to "beads" and never moves again (ticket 0925)', async () => {
    const wrapper = slogan()
    const column = wrapper.get('[data-testid="slogan-column"]')
    expect(column.attributes('style')).toContain(`* ${-SLOGAN_WORDS.length})`)
    await vi.advanceTimersByTimeAsync(SLOGAN_HOLD_MS - 1)
    expect(rolling(wrapper)).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(rolling(wrapper)).toBe(true)
    expect(column.attributes('style')).toContain('* 0)')

    await vi.advanceTimersByTimeAsync(SLOGAN_ROLL_MS)
    expect(rolling(wrapper)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(column.attributes('style')).toContain('* 0)')
  })

  it('stays "openbeads" under reduced motion', async () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(prefers-reduced-motion: reduce)': true }).matchMedia)
    const wrapper = slogan()
    await vi.advanceTimersByTimeAsync(SLOGAN_HOLD_MS + SLOGAN_ROLL_MS)
    expect(rolling(wrapper)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rests at once when reduced motion is turned on during its pass', async () => {
    const media = fakeMatchMedia({ '(prefers-reduced-motion: reduce)': false })
    vi.stubGlobal('matchMedia', media.matchMedia)
    const wrapper = slogan()
    await vi.advanceTimersByTimeAsync(SLOGAN_HOLD_MS)
    media.set('(prefers-reduced-motion: reduce)', true)
    await nextTick()
    expect(rolling(wrapper)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits while the page is hidden and plays its pass when first shown', async () => {
    const wrapper = slogan()
    setHidden(true)
    await vi.advanceTimersByTimeAsync(SLOGAN_HOLD_MS * 3)
    expect(rolling(wrapper)).toBe(false)
    setHidden(false)
    await vi.advanceTimersByTimeAsync(SLOGAN_HOLD_MS)
    expect(rolling(wrapper)).toBe(true)
  })

  it('rests at once when hidden during its pass, and does not play again', async () => {
    const wrapper = slogan()
    await vi.advanceTimersByTimeAsync(SLOGAN_HOLD_MS + SLOGAN_ROLL_MS / 2)
    setHidden(true)
    await nextTick()
    expect(rolling(wrapper)).toBe(false)
    setHidden(false)
    await vi.advanceTimersByTimeAsync(SLOGAN_HOLD_MS + SLOGAN_ROLL_MS)
    expect(rolling(wrapper)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves no timer running once unmounted', () => {
    const wrapper = slogan()
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
