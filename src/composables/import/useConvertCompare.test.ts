import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { COMPARE_HOLD_MS, useConvertCompare } from './useConvertCompare'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const key = (name: string, repeat = false) => ({ key: name, repeat, preventDefault: vi.fn() }) as unknown as KeyboardEvent

describe('useConvertCompare (ConvertImage card DS-3, ticket 0909)', () => {
  it('puts the picture beside the beads on a press, wide, until pressed again', () => {
    const compare = useConvertCompare({ narrow: ref(false) })
    expect(compare.sideBySide.value).toBe(false)
    compare.pressStart()
    compare.pressEnd()
    expect(compare.clicked()).toBe(true)
    expect([compare.sideBySide.value, compare.pictureAlone.value]).toEqual([true, false])
    compare.pressStart()
    compare.pressEnd()
    compare.clicked()
    expect(compare.sideBySide.value).toBe(false)
  })

  it('shows the picture in the beads’ place while a press is held past 300 ms, and does not toggle', () => {
    const compare = useConvertCompare({ narrow: ref(false) })
    compare.pressStart()
    vi.advanceTimersByTime(COMPARE_HOLD_MS - 1)
    expect(compare.held.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect([compare.held.value, compare.pictureAlone.value, compare.sideBySide.value]).toEqual([true, true, false])
    compare.pressEnd()
    // The click the browser sends on letting go is the hold's own.
    expect(compare.clicked()).toBe(false)
    expect([compare.held.value, compare.on.value]).toEqual([false, false])
  })

  it('runs the same action from Enter and Space: a tap toggles, a hold shows in place', () => {
    const compare = useConvertCompare({ narrow: ref(false) })
    const down = key('Enter')
    compare.keyDown(down)
    expect(down.preventDefault).toHaveBeenCalled()
    compare.keyUp(key('Enter'))
    expect(compare.clicked()).toBe(false)
    expect(compare.on.value).toBe(true)

    compare.keyDown(key(' '))
    compare.keyDown(key(' ', true))
    vi.advanceTimersByTime(COMPARE_HOLD_MS)
    expect(compare.held.value).toBe(true)
    compare.keyUp(key(' '))
    expect([compare.held.value, compare.on.value]).toEqual([false, true])
    compare.keyDown(key('a'))
    vi.advanceTimersByTime(COMPARE_HOLD_MS)
    expect(compare.held.value).toBe(false)
  })

  it('lets a click with no press before it (a screen reader’s) toggle, and a stray mark never eats a later click', async () => {
    const compare = useConvertCompare({ narrow: ref(false) })
    expect(compare.clicked()).toBe(true)
    expect(compare.on.value).toBe(true)
    compare.pressStart()
    vi.advanceTimersByTime(COMPARE_HOLD_MS)
    compare.pressEnd()
    vi.advanceTimersByTime(0)
    expect(compare.clicked()).toBe(true)
    expect(compare.on.value).toBe(false)
  })

  it('chooses Picture or Beads under 1024 px, and a narrowing or widening page goes back to the beads', async () => {
    const narrow = ref(true)
    const compare = useConvertCompare({ narrow })
    compare.choose('picture')
    expect([compare.shown.value, compare.pictureAlone.value, compare.sideBySide.value]).toEqual(['picture', true, false])
    compare.choose('beads')
    expect(compare.shown.value).toBe('beads')
    compare.choose('picture')
    narrow.value = false
    await nextTick()
    expect([compare.on.value, compare.sideBySide.value, compare.pictureAlone.value]).toEqual([false, false, false])
    compare.clicked()
    narrow.value = true
    await nextTick()
    expect(compare.shown.value).toBe('beads')
  })
})
