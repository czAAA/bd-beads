import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCROLLS_TO_UNROLL, useFreeRoll } from './useFreeRoll'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

/** A burst of scroll events the way a wheel or a swipe sends them, 16ms apart, then a pause. */
function scrollBurst(roll: ReturnType<typeof useFreeRoll>, events = 6) {
  for (let i = 0; i < events; i++) {
    roll.onWindowScroll()
    vi.advanceTimersByTime(16)
  }
  vi.advanceTimersByTime(400)
}

describe('useFreeRoll', () => {
  it('lights a bead per scroll, a burst of scrolling counting as one', () => {
    const roll = useFreeRoll()
    expect(roll.lit.value).toBe(0)
    scrollBurst(roll)
    expect(roll.lit.value).toBe(1)
    scrollBurst(roll, 20)
    expect(roll.lit.value).toBe(2)
    expect(roll.unrolled.value).toBe(false)
  })

  it('unrolls on the third scroll, at its first event, and counts no further while down', () => {
    const roll = useFreeRoll()
    scrollBurst(roll)
    scrollBurst(roll)
    roll.onWindowScroll()
    expect(roll.unrolled.value).toBe(true)
    expect(roll.lit.value).toBe(3)
    scrollBurst(roll)
    expect(roll.lit.value).toBe(3)
  })

  it('rolls back up with no bead lit, and counts afresh', () => {
    const roll = useFreeRoll()
    for (let i = 0; i < SCROLLS_TO_UNROLL; i++) scrollBurst(roll)
    roll.rollUp()
    expect(roll.unrolled.value).toBe(false)
    expect(roll.lit.value).toBe(0)
    scrollBurst(roll)
    expect(roll.lit.value).toBe(1)
  })

  it('does not count the scroll its own reset of the window makes', () => {
    const roll = useFreeRoll()
    roll.ignoreNextScroll()
    roll.onWindowScroll()
    expect(roll.lit.value).toBe(0)
  })
})
