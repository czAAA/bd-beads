import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'
import { createPattern, type Pattern } from '../../domain/pattern'
import { SUMMARY_INTERVAL_MS, useSettledPattern } from './useSettledPattern'

function patternNamed(name: string): Pattern {
  return { ...createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } }), name }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSettledPattern', () => {
  it('starts as the Pattern', () => {
    const open = shallowRef<Pattern | undefined>(patternNamed('one'))

    expect(useSettledPattern(() => open.value, () => false).value).toBe(open.value)
  })

  it('follows every change to the Pattern while nothing is being drawn', () => {
    const open = shallowRef<Pattern | undefined>(patternNamed('one'))
    const settled = useSettledPattern(() => open.value, () => false)
    const next = patternNamed('two')

    open.value = next

    expect(settled.value).toBe(next)
  })

  it('follows the first change of a stroke at once, so a single click shows straight away', () => {
    const open = shallowRef<Pattern | undefined>(patternNamed('before'))
    const drawing = shallowRef(false)
    const settled = useSettledPattern(() => open.value, () => drawing.value)

    drawing.value = true
    const first = patternNamed('first bead')
    open.value = first

    expect(settled.value).toBe(first)
  })

  it('then looks again only every so often, however many beads the stroke changes', async () => {
    const open = shallowRef<Pattern | undefined>(patternNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledPattern(() => open.value, () => drawing.value)
    const first = patternNamed('first')
    open.value = first
    expect(settled.value).toBe(first)

    open.value = patternNamed('second')
    open.value = patternNamed('third')
    const last = patternNamed('last')
    open.value = last
    expect(settled.value).toBe(first)

    await vi.advanceTimersByTimeAsync(SUMMARY_INTERVAL_MS)
    expect(settled.value).toBe(last)
  })

  it('reads the Pattern as it is when its turn comes, not as it was when it was asked for', async () => {
    const open = shallowRef<Pattern | undefined>(patternNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledPattern(() => open.value, () => drawing.value)
    open.value = patternNamed('first')

    open.value = patternNamed('second')
    await vi.advanceTimersByTimeAsync(SUMMARY_INTERVAL_MS / 2)
    const latest = patternNamed('latest')
    open.value = latest
    await vi.advanceTimersByTimeAsync(SUMMARY_INTERVAL_MS)

    expect(settled.value).toBe(latest)
  })

  it('catches up the moment the stroke ends', async () => {
    const open = shallowRef<Pattern | undefined>(patternNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledPattern(() => open.value, () => drawing.value)
    open.value = patternNamed('first')
    const last = patternNamed('last')
    open.value = last

    drawing.value = false
    await nextTick()

    expect(settled.value).toBe(last)
  })

  it('does not look again after the stroke has ended and it has caught up', async () => {
    const open = shallowRef<Pattern | undefined>(patternNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledPattern(() => open.value, () => drawing.value)
    open.value = patternNamed('first')
    open.value = patternNamed('second')
    drawing.value = false
    const after = patternNamed('after')
    open.value = after

    await vi.advanceTimersByTimeAsync(SUMMARY_INTERVAL_MS * 2)

    expect(settled.value).toBe(after)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('follows the first change of the next stroke at once as well, however soon it comes', () => {
    const open = shallowRef<Pattern | undefined>(patternNamed('before'))
    const drawing = shallowRef(true)
    const settled = useSettledPattern(() => open.value, () => drawing.value)
    open.value = patternNamed('first stroke')
    drawing.value = false

    drawing.value = true
    const next = patternNamed('second stroke')
    open.value = next

    expect(settled.value).toBe(next)
  })

  it('with an interval of Infinity, waits for the stroke to end', async () => {
    const open = shallowRef<Pattern | undefined>(patternNamed('before'))
    const drawing = shallowRef(true)
    const before = open.value
    const settled = useSettledPattern(() => open.value, () => drawing.value, Number.POSITIVE_INFINITY)

    open.value = patternNamed('first')
    await vi.advanceTimersByTimeAsync(60_000)
    open.value = patternNamed('second')
    expect(settled.value).toBe(before)
    expect(vi.getTimerCount()).toBe(0)

    const last = patternNamed('last')
    open.value = last
    drawing.value = false
    expect(settled.value).toBe(last)
  })

  it('follows a Pattern being closed, and another being opened', () => {
    const open = shallowRef<Pattern | undefined>(patternNamed('one'))
    const settled = useSettledPattern(() => open.value, () => false)

    open.value = undefined
    expect(settled.value).toBeUndefined()

    const other = patternNamed('other')
    open.value = other
    expect(settled.value).toBe(other)
  })
})
