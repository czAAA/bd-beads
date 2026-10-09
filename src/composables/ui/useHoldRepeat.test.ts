import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOLD_DELAY_MS, HOLD_MIN_INTERVAL_MS, HOLD_START_INTERVAL_MS, useHoldRepeat } from './useHoldRepeat'

describe('useHoldRepeat', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup(limit = Infinity) {
    let value = 0
    const step = vi.fn((direction: 1 | -1) => {
      const next = Math.min(limit, value + direction)
      if (next === value) return false
      value = next
      return true
    })
    const { handlers } = useHoldRepeat(step)
    return { up: handlers(1), down: handlers(-1), step, value: () => value }
  }
  const mouse = { pointerType: 'mouse', button: 0 } as PointerEvent

  it('steps once on a plain click and not again on release', () => {
    const { up, value } = setup()
    up.pointerdown(mouse)
    up.pointerup()
    up.click()
    expect(value()).toBe(1)
    vi.advanceTimersByTime(5000)
    expect(value()).toBe(1)
  })

  it('steps once for a click with no press before it', () => {
    const { up, value } = setup()
    up.click()
    expect(value()).toBe(1)
  })

  it('repeats after the delay, speeds up, and stops on release', () => {
    const { up, value } = setup()
    up.pointerdown(mouse)
    vi.advanceTimersByTime(HOLD_DELAY_MS - 1)
    expect(value()).toBe(1)
    vi.advanceTimersByTime(1)
    expect(value()).toBe(2)
    vi.advanceTimersByTime(HOLD_START_INTERVAL_MS * 0.85)
    expect(value()).toBe(3)
    vi.advanceTimersByTime(10_000)
    const gaps = value()
    expect(gaps).toBeGreaterThan(10_000 / HOLD_START_INTERVAL_MS)
    up.pointerup()
    vi.advanceTimersByTime(10_000)
    expect(value()).toBe(gaps)
    expect(HOLD_MIN_INTERVAL_MS).toBeLessThan(HOLD_START_INTERVAL_MS)
  })

  it('stops when the pointer leaves, and the click that never comes does not linger', () => {
    const { up, value } = setup()
    up.pointerdown(mouse)
    up.pointerleave()
    vi.advanceTimersByTime(5000)
    expect(value()).toBe(1)
    up.click()
    expect(value()).toBe(2)
  })

  it('keeps the click to swallow when touch leaves after the release', () => {
    const { up, value } = setup()
    up.pointerdown({ pointerType: 'touch', button: 0 } as PointerEvent)
    up.pointerup()
    up.pointerleave()
    up.click()
    expect(value()).toBe(1)
  })

  it('stops by itself at the limit', () => {
    const { up, step } = setup(3)
    up.pointerdown(mouse)
    vi.advanceTimersByTime(10_000)
    expect(step).toHaveBeenCalledTimes(4)
  })

  it('ignores a secondary mouse button', () => {
    const { up, value } = setup()
    up.pointerdown({ pointerType: 'mouse', button: 2 } as PointerEvent)
    expect(value()).toBe(0)
  })

  it('repeats while Enter or Space is held, ignoring key auto-repeat, and a keypress steps once', () => {
    const { down, value } = setup()
    const key = (name: string, repeat = false) => ({ key: name, repeat, preventDefault: vi.fn() }) as unknown as KeyboardEvent
    down.keydown(key(' '))
    down.keydown(key(' ', true))
    expect(value()).toBe(-1)
    vi.advanceTimersByTime(HOLD_DELAY_MS)
    expect(value()).toBe(-2)
    down.keyup(key(' '))
    vi.advanceTimersByTime(5000)
    expect(value()).toBe(-2)

    const tab = key('Tab')
    down.keydown(tab)
    expect(tab.preventDefault).not.toHaveBeenCalled()
  })
})
