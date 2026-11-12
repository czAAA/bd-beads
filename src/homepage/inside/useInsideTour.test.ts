import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { TOUR_TIMING, useInsideTour } from './useInsideTour'

const ROWS = ['canvas', 'techniques', 'editing', 'mirror'] as const
type Row = (typeof ROWS)[number]

/** A hand that says how it was made: playing, or applying at once. */
interface FakeHand {
  instant: boolean
}

/** The tour on fake rows, each taking `rowMs` when played and nothing when applied, and everything it did, in order. */
function tourHost(options: { reducedMotion?: boolean; rowMs?: number; seen?: boolean; failing?: Row } = {}) {
  const done: string[] = []
  const seen = ref(options.seen ?? true)
  const reduced = ref(options.reducedMotion ?? false)
  let tour!: ReturnType<typeof useInsideTour<Row, FakeHand>>
  const wrapper = mount(
    defineComponent({
      setup() {
        tour = useInsideTour<Row, FakeHand>({
          rows: ROWS,
          fresh: async () => void done.push('fresh'),
          hand: (instant) => ({ instant }),
          play: async (row, hand) => {
            done.push(hand.instant ? `apply ${row}` : `play ${row}`)
            if (row === options.failing) throw new Error(`The tour found no ${row}`)
            if (!hand.instant) await new Promise((resolve) => setTimeout(resolve, options.rowMs ?? 1000))
          },
          hideGhost: () => void done.push('hide'),
          reducedMotion: () => reduced.value,
          isStop: () => false,
        })
        tour.follow(() => seen.value)
        return () => h('div')
      },
    }),
  )
  /** What it did, the ghost's hiding on each stop left out. */
  const steps = () => done.filter((step) => step !== 'hide')
  return { done, steps, seen, tour, wrapper }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("What's inside's tour (ticket 0797)", () => {
  it('starts by itself a moment after the section first shows, then plays the rows in order, each lit while it plays', async () => {
    const { done, steps, tour } = tourHost()
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.start - 1)
    expect(steps()).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(steps()).toEqual(['fresh'])
    expect(tour.playing.value).toBe('canvas')

    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before)
    expect(done.at(-1)).toBe('play canvas')
    await vi.advanceTimersByTimeAsync(1000 + TOUR_TIMING.after + TOUR_TIMING.before)
    expect(tour.playing.value).toBe('techniques')
    expect(done.at(-1)).toBe('play techniques')
  })

  it('rests after the last row, the list unlit and the ghost hidden, then starts again on a fresh demo', async () => {
    const { done, tour } = tourHost()
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.start + ROWS.length * (TOUR_TIMING.before + 1000 + TOUR_TIMING.after))
    expect(done.filter((step) => step.startsWith('play'))).toEqual(ROWS.map((row) => `play ${row}`))
    expect(tour.playing.value).toBeUndefined()
    expect(done.at(-1)).toBe('hide')

    await vi.advanceTimersByTimeAsync(TOUR_TIMING.rest)
    expect(done.slice(-1)).toEqual(['fresh'])
    expect(tour.playing.value).toBe('canvas')
  })

  it('plays from a row pressed: a fresh demo, the rows before it applied at once, then the rest played', async () => {
    const { steps, tour } = tourHost({ seen: false })
    tour.choose('editing')
    await vi.advanceTimersByTimeAsync(0)
    expect(steps()).toEqual(['fresh', 'apply canvas', 'apply techniques'])
    expect(tour.playing.value).toBe('editing')

    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before + 1000 + TOUR_TIMING.after + TOUR_TIMING.before)
    expect(steps().slice(3)).toEqual(['play editing', 'play mirror'])
  })

  it('lights a row pressed at once, before the demo is fresh', () => {
    const { tour } = tourHost({ seen: false })
    tour.choose('mirror')
    expect(tour.playing.value).toBe('mirror')
  })

  it('jumps back to an earlier row as well as forward', async () => {
    const { steps, tour } = tourHost({ seen: false })
    tour.choose('mirror')
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before)
    expect(steps()).toEqual(['fresh', 'apply canvas', 'apply techniques', 'apply editing', 'play mirror'])

    tour.choose('techniques')
    expect(tour.playing.value).toBe('techniques')
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before)
    expect(steps().slice(5)).toEqual(['fresh', 'apply canvas', 'play techniques'])
  })

  it('skips a row that cannot be done to the next, warning once however often the loop comes to it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { steps, tour } = tourHost({ seen: false, failing: 'techniques' })
    tour.choose('techniques')
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before + TOUR_TIMING.after)
    expect(tour.playing.value).toBe('editing')
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before)
    expect(steps().filter((step) => step.startsWith('play'))).toEqual(['play techniques', 'play editing'])

    // Round the loop again: applied or played, the same row warns no more.
    tour.choose('mirror')
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before)
    expect(tour.playing.value).toBe('mirror')
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('takes a row pressed before it starts by itself over the start', async () => {
    const { done, tour } = tourHost()
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.start / 2)
    tour.choose('mirror')
    await vi.advanceTimersByTimeAsync(2000)
    expect(done.filter((step) => step === 'fresh')).toHaveLength(1)
    expect(done).toContain('play mirror')
    expect(done).not.toContain('play canvas')
  })

  it('plays only while seen, and starts again from the first row when seen again', async () => {
    const { steps, seen, tour } = tourHost()
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.start + TOUR_TIMING.before + 1000 + TOUR_TIMING.after + TOUR_TIMING.before)
    expect(tour.playing.value).toBe('techniques')

    seen.value = false
    await vi.advanceTimersByTimeAsync(0)
    expect(tour.playing.value).toBeUndefined()
    const before = steps().length
    await vi.advanceTimersByTimeAsync(5000)
    expect(steps().slice(before)).toEqual([])

    seen.value = true
    await vi.advanceTimersByTimeAsync(0)
    expect(steps().slice(before)).toEqual(['fresh'])
    expect(tour.playing.value).toBe('canvas')
  })

  it('under reduced motion shows the end of a row at once, with no ghost and no loop', async () => {
    const { steps, tour } = tourHost({ reducedMotion: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(steps()).toEqual(['fresh', 'apply canvas'])
    expect(tour.playing.value).toBe('canvas')

    tour.choose('editing')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(steps().slice(2)).toEqual(['fresh', 'apply canvas', 'apply techniques', 'apply editing'])
    expect(tour.playing.value).toBe('editing')
  })

  it('captions the row last lit: the first before the tour starts, kept through the rest and a pause (ticket 0825)', async () => {
    const { tour } = tourHost()
    expect(tour.captioned.value).toBe('canvas')
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.start + TOUR_TIMING.before + 1000 + TOUR_TIMING.after + TOUR_TIMING.before)
    expect(tour.captioned.value).toBe('techniques')
    tour.pause()
    expect(tour.captioned.value).toBe('techniques')

    tour.choose('mirror')
    expect(tour.captioned.value).toBe('mirror')
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before + 1000 + TOUR_TIMING.after)
    expect(tour.playing.value).toBeUndefined()
    expect(tour.captioned.value).toBe('mirror')
  })
})

describe("What's inside's Pause and Play (ticket 0830)", () => {
  /** The tour playing its second row. */
  async function onSecondRow() {
    const host = tourHost()
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.start + TOUR_TIMING.before + 1000 + TOUR_TIMING.after + TOUR_TIMING.before)
    expect(host.tour.playing.value).toBe('techniques')
    return host
  }

  it('pauses where it is: the ghost hidden, the row still lit, nothing more played', async () => {
    const { done, steps, tour } = await onSecondRow()
    tour.pause()
    expect(tour.paused.value).toBe(true)
    expect(done.at(-1)).toBe('hide')
    expect(tour.playing.value).toBe('techniques')
    const before = steps().length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(steps().slice(before)).toEqual([])
    expect(tour.playing.value).toBe('techniques')
  })

  it('plays on from the start of the row that was playing: a fresh demo, the rows before it applied at once', async () => {
    const { steps, tour } = await onSecondRow()
    tour.pause()
    const before = steps().length
    tour.resume()
    expect(tour.paused.value).toBe(false)
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before)
    expect(steps().slice(before)).toEqual(['fresh', 'apply canvas', 'play techniques'])
  })

  it('stays paused at its row when the page turns away and back', async () => {
    const { steps, seen, tour } = await onSecondRow()
    tour.pause()
    const before = steps().length
    seen.value = false
    await vi.advanceTimersByTimeAsync(0)
    seen.value = true
    await vi.advanceTimersByTimeAsync(60_000)
    expect(steps().slice(before)).toEqual([])
    expect(tour.paused.value).toBe(true)
    expect(tour.playing.value).toBe('techniques')
  })

  it('plays a row chosen while paused, paused no more', async () => {
    const { tour } = await onSecondRow()
    tour.pause()
    tour.choose('mirror')
    expect(tour.paused.value).toBe(false)
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before)
    expect(tour.playing.value).toBe('mirror')
  })

  it('paused before it has started, plays from the first row', async () => {
    const { steps, tour } = tourHost()
    tour.pause()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(steps()).toEqual([])
    tour.resume()
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.before)
    expect(steps()).toEqual(['fresh', 'play canvas'])
  })
})
