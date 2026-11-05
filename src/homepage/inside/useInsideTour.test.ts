import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { useInsideTour } from './useInsideTour'

const ROWS = ['canvas', 'techniques', 'editing', 'mirror'] as const
type Row = (typeof ROWS)[number]

/** A hand that says how it was made: playing, or applying at once. */
interface FakeHand {
  instant: boolean
}

/** The tour on fake rows, each taking `rowMs` when played and nothing when applied, and everything it did, in order. */
function tourHost(options: { reducedMotion?: boolean; rowMs?: number; seen?: boolean } = {}) {
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
  it('starts by itself 900ms after the section first shows, then plays the rows in order, each lit while it plays', async () => {
    const { done, steps, tour } = tourHost()
    await vi.advanceTimersByTimeAsync(899)
    expect(steps()).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(steps()).toEqual(['fresh'])
    expect(tour.playing.value).toBe('canvas')

    await vi.advanceTimersByTimeAsync(350)
    expect(done.at(-1)).toBe('play canvas')
    await vi.advanceTimersByTimeAsync(1000 + 450 + 350)
    expect(tour.playing.value).toBe('techniques')
    expect(done.at(-1)).toBe('play techniques')
  })

  it('rests 1.8s after the last row, the list unlit and the ghost hidden, then starts again on a fresh demo', async () => {
    const { done, tour } = tourHost()
    await vi.advanceTimersByTimeAsync(900 + ROWS.length * (350 + 1000 + 450))
    expect(done.filter((step) => step.startsWith('play'))).toEqual(ROWS.map((row) => `play ${row}`))
    expect(tour.playing.value).toBeUndefined()
    expect(done.at(-1)).toBe('hide')

    await vi.advanceTimersByTimeAsync(1800)
    expect(done.slice(-1)).toEqual(['fresh'])
    expect(tour.playing.value).toBe('canvas')
  })

  it('plays from a row pressed: a fresh demo, the rows before it applied at once, then the rest played', async () => {
    const { steps, tour } = tourHost({ seen: false })
    tour.choose('editing')
    await vi.advanceTimersByTimeAsync(0)
    expect(steps()).toEqual(['fresh', 'apply canvas', 'apply techniques'])
    expect(tour.playing.value).toBe('editing')

    await vi.advanceTimersByTimeAsync(350 + 1000 + 450 + 350)
    expect(steps().slice(3)).toEqual(['play editing', 'play mirror'])
  })

  it('takes a row pressed before it starts by itself over the start', async () => {
    const { done, tour } = tourHost()
    await vi.advanceTimersByTimeAsync(400)
    tour.choose('mirror')
    await vi.advanceTimersByTimeAsync(2000)
    expect(done.filter((step) => step === 'fresh')).toHaveLength(1)
    expect(done).toContain('play mirror')
    expect(done).not.toContain('play canvas')
  })

  it('stops for the visit once the beader takes the editor over, the list unlit, until a row is pressed', async () => {
    const { done, seen, tour } = tourHost()
    await vi.advanceTimersByTimeAsync(900 + 350)
    tour.takeOver()
    expect(tour.playing.value).toBeUndefined()
    expect(tour.takenOver.value).toBe(true)
    const before = done.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(done.filter((step) => step.startsWith('play'))).toEqual(['play canvas'])

    // Turning away and back does not start it again: the beader's editor is kept as they left it.
    seen.value = false
    await vi.advanceTimersByTimeAsync(0)
    seen.value = true
    await vi.advanceTimersByTimeAsync(5000)
    expect(done.slice(before).filter((step) => step === 'fresh')).toEqual([])

    tour.choose('techniques')
    await vi.advanceTimersByTimeAsync(0)
    expect(tour.takenOver.value).toBe(false)
    expect(tour.playing.value).toBe('techniques')
  })

  it('plays only while seen, and starts again from the first row when seen again', async () => {
    const { steps, seen, tour } = tourHost()
    await vi.advanceTimersByTimeAsync(900 + 350 + 1000 + 450 + 350)
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
})
