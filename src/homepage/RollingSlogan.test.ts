import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { fakeMatchMedia } from '../testUtils/fakeMatchMedia'
import RollingSlogan from './RollingSlogan.vue'
import { SLOGAN_HOLD_MS, SLOGAN_ROLL_MS, SLOGAN_WORDS } from './slogan'

const STEP_MS = SLOGAN_HOLD_MS + SLOGAN_ROLL_MS

function slogan() {
  return mount(RollingSlogan, { attachTo: document.body })
}
const word = (w: ReturnType<typeof slogan>) => w.attributes('data-word')

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
    expect(wrapper.attributes('aria-label')).toBe('openbeads')
    expect(wrapper.get('.slogan__slot').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.slogan__open').text()).toBe('open')
  })

  it('starts on "beads", holds it, then moves through the words in order and back to "beads"', async () => {
    const wrapper = slogan()
    const seen = [word(wrapper)]
    for (let i = 0; i < SLOGAN_WORDS.length; i++) {
      await vi.advanceTimersByTimeAsync(STEP_MS)
      seen.push(word(wrapper))
    }
    expect(seen).toEqual([...SLOGAN_WORDS, SLOGAN_WORDS[0]])
    await vi.advanceTimersByTimeAsync(STEP_MS)
    expect(word(wrapper)).toBe('draw')
  })

  it('rolls the column down one line a step and returns to the first word with the transition off', async () => {
    const wrapper = slogan()
    const column = wrapper.get('[data-testid="slogan-column"]')
    const first = column.attributes('style')
    await vi.advanceTimersByTimeAsync(SLOGAN_HOLD_MS)
    expect(column.attributes('style')).not.toBe(first)
    expect(column.classes()).not.toContain('slogan__column--still')

    await vi.advanceTimersByTimeAsync(STEP_MS * (SLOGAN_WORDS.length - 1) + SLOGAN_ROLL_MS)
    expect(column.attributes('style')).toBe(first)
    expect(column.classes()).toContain('slogan__column--still')
  })

  it('stays "openbeads" under reduced motion', async () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(prefers-reduced-motion: reduce)': true }).matchMedia)
    const wrapper = slogan()
    await vi.advanceTimersByTimeAsync(STEP_MS * 3)
    expect(word(wrapper)).toBe('beads')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('pauses while the page is hidden and goes on when it is shown', async () => {
    const wrapper = slogan()
    setHidden(true)
    await vi.advanceTimersByTimeAsync(STEP_MS * 3)
    expect(word(wrapper)).toBe('beads')
    setHidden(false)
    await vi.advanceTimersByTimeAsync(SLOGAN_HOLD_MS)
    expect(word(wrapper)).toBe('draw')
  })

  it('goes on from "beads" when hidden while rolling onto the closing "beads"', async () => {
    const wrapper = slogan()
    await vi.advanceTimersByTimeAsync(STEP_MS * (SLOGAN_WORDS.length - 1) + SLOGAN_HOLD_MS)
    expect(word(wrapper)).toBe('beads')
    setHidden(true)
    setHidden(false)
    await vi.advanceTimersByTimeAsync(SLOGAN_HOLD_MS)
    expect(word(wrapper)).toBe('draw')
  })

  it('leaves no timer running once unmounted', () => {
    const wrapper = slogan()
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
