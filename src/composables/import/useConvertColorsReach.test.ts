import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { Grid } from '../../domain/project'
import { useConvertColorsReach } from './useConvertColorsReach'
import { NEIGHBOURS_REST_MS } from './useConvertNeighbours'

/** A one-bead grid whose color names the count, up to a cap past which the beads stay the same (all the picture gives). */
const beadsFor = (cap: number) => (count: number): Grid => [[{ color: `#${String(Math.min(count, cap)).padStart(6, '0')}` }]]

function reachOf({ start = 40, cap = 7 } = {}) {
  const count = ref(start)
  const found = ref(Math.min(start, cap))
  const beadsAt = vi.fn(async (at: number) => beadsFor(cap)(at))
  const beadsShown = ref<Grid>(beadsFor(cap)(start))
  const reach = effectScope().run(() => useConvertColorsReach({ count, found, beadsAt, beadsShown }))!
  const set = (next: number, nextCap = cap) => {
    count.value = next
    found.value = Math.min(next, nextCap)
    beadsShown.value = beadsFor(nextCap)(next)
    beadsAt.mockImplementation(async (at: number) => beadsFor(nextCap)(at))
  }
  return { reach, count, beadsAt, set }
}

/** Lets the count rest and every step of the search run, each waiting for its beads. */
async function rest() {
  await nextTick()
  await vi.advanceTimersByTimeAsync(NEIGHBOURS_REST_MS)
  for (let step = 0; step < 12; step++) await vi.advanceTimersByTimeAsync(1)
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('The last count that changes the beads (ticket 0928)', () => {
  it('is the least count whose beads are those shown, once the count rests', async () => {
    const { reach } = reachOf({ start: 40, cap: 7 })
    expect(reach.value).toBeUndefined()
    await rest()
    expect(reach.value).toBe(7)
  })

  it('is none, with nothing worked out, where as many colors are found as asked', async () => {
    const { reach, beadsAt } = reachOf({ start: 6, cap: 7 })
    await rest()
    expect(reach.value).toBeUndefined()
    expect(beadsAt).not.toHaveBeenCalled()
  })

  it('looks at only a few counts, never below the colors found', async () => {
    const { beadsAt } = reachOf({ start: 40, cap: 7 })
    await rest()
    expect(beadsAt.mock.calls.length).toBeLessThanOrEqual(6)
    expect(beadsAt.mock.calls.every(([at]) => at >= 7)).toBe(true)
  })

  it('follows a change, and keeps the last one found while the next is worked out', async () => {
    const card = reachOf({ start: 40, cap: 7 })
    await rest()
    card.set(30, 9)
    await nextTick()
    expect(card.reach.value).toBe(7)
    await rest()
    expect(card.reach.value).toBe(9)
    card.set(5, 9)
    await nextTick()
    expect(card.reach.value).toBeUndefined()
  })

  it('drops a search the count moved away from while its beads were worked out (ticket 1253)', async () => {
    const card = reachOf({ start: 40, cap: 7 })
    let release!: () => void
    card.beadsAt.mockImplementationOnce((at: number) => new Promise((done) => (release = () => done(beadsFor(7)(at)))))
    await nextTick()
    await vi.advanceTimersByTimeAsync(NEIGHBOURS_REST_MS)
    card.set(30, 9)
    release()
    await rest()
    expect(card.reach.value).toBe(9)
  })
})
