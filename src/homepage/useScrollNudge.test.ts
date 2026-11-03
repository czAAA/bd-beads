import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useScrollNudge } from './useScrollNudge'

describe('the Homepage nudging that it scrolls (ticket 0784)', () => {
  const scopes: ReturnType<typeof effectScope>[] = []
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
    vi.useRealTimers()
  })

  function nudge(options: { first?: boolean; reduced?: boolean } = {}) {
    const first = ref(options.first ?? true)
    const reducedMotion = ref(options.reduced ?? false)
    const scope = effectScope()
    scopes.push(scope)
    const made = scope.run(() => useScrollNudge({ onFirst: () => first.value, reducedMotion }))!
    return { ...made, first }
  }

  it('plays after 1.5s of stillness on the first section, for the length of the lift', () => {
    const { nudging } = nudge()
    vi.advanceTimersByTime(1499)
    expect(nudging.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect(nudging.value).toBe(true)
    vi.advanceTimersByTime(1100)
    expect(nudging.value).toBe(false)
  })

  it('plays once per device', () => {
    nudge()
    vi.advanceTimersByTime(3000)
    const again = nudge()
    vi.advanceTimersByTime(3000)
    expect(again.nudging.value).toBe(false)
  })

  it('never plays for a beader who scrolled first, on this visit or the next', () => {
    const { nudging, scrolled } = nudge()
    vi.advanceTimersByTime(1000)
    scrolled()
    vi.advanceTimersByTime(3000)
    expect(nudging.value).toBe(false)
    const next = nudge()
    vi.advanceTimersByTime(3000)
    expect(next.nudging.value).toBe(false)
  })

  it('does not play on a visit with a press or a key first, but may on the next, as those do not tell the page scrolls', () => {
    const { nudging, acted } = nudge()
    vi.advanceTimersByTime(1000)
    acted()
    vi.advanceTimersByTime(3000)
    expect(nudging.value).toBe(false)
    const next = nudge()
    vi.advanceTimersByTime(1500)
    expect(next.nudging.value).toBe(true)
  })

  it('stops at once when the beader acts mid-lift', () => {
    const { nudging, acted } = nudge()
    vi.advanceTimersByTime(1600)
    acted()
    expect(nudging.value).toBe(false)
  })

  it('does not play away from the first section, or under reduced motion', () => {
    const away = nudge({ first: false })
    vi.advanceTimersByTime(3000)
    expect(away.nudging.value).toBe(false)
    const reduced = nudge({ reduced: true })
    vi.advanceTimersByTime(3000)
    expect(reduced.nudging.value).toBe(false)
  })
})
