import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { Grid } from '../../domain/project'
import { NEIGHBOURS_REST_MS, NEIGHBOUR_PREVIEWS_UP_TO, useConvertNeighbours } from './useConvertNeighbours'

/** A one-bead grid whose color names the count, up to a cap past which the beads stay the same (codes left). */
const beadsFor = (cap: number) => (count: number): Grid => [[{ color: `#${String(Math.min(count, cap)).padStart(6, '0')}` }]]

function neighbours({ start = 12, most = 256, cap = 999 } = {}) {
  const count = ref(start)
  const shown = ref(false)
  const beadsAt = vi.fn(async (at: number) => beadsFor(cap)(at))
  const beadsShown = ref<Grid>([])
  const used = ref(0)
  const sync = () => {
    beadsShown.value = beadsFor(cap)(count.value)
    used.value = Math.min(count.value, cap)
  }
  sync()
  const card = effectScope().run(() => useConvertNeighbours({ count, most: ref(most), shown, found: used, beadsAt, beadsShown }))!
  return { ...card, count, shown, beadsAt, beadsShown, used, set: (next: number) => ((count.value = next), sync()) }
}

/** Lets the count rest and both neighbours be worked out. */
async function rest() {
  await nextTick()
  await vi.advanceTimersByTimeAsync(NEIGHBOURS_REST_MS)
  await vi.advanceTimersByTimeAsync(1)
  await nextTick()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('The Colors neighbours (ticket 0904)', () => {
  it('works nothing out while the card is hidden, and both sides once it shows and the count rests', async () => {
    const card = neighbours()
    await rest()
    expect(card.fewer.value).toMatchObject({ count: 11, beads: undefined })
    expect(card.beadsAt).not.toHaveBeenCalled()

    card.shown.value = true
    await rest()
    expect(card.fewer.value).toEqual({ end: false, count: 11, beads: beadsFor(999)(11), same: false })
    expect(card.more.value).toEqual({ end: false, count: 13, beads: beadsFor(999)(13), same: false })
  })

  it('keeps the drawn beads while the count moves, and draws the new ones only once it rests', async () => {
    const card = neighbours()
    card.shown.value = true
    await rest()
    card.set(13)
    await nextTick()
    vi.advanceTimersByTime(NEIGHBOURS_REST_MS / 2)
    card.set(14)
    await nextTick()
    vi.advanceTimersByTime(NEIGHBOURS_REST_MS / 2)
    // The places follow the count at once, the beads drawn at 11 and 13 kept in them.
    expect(card.fewer.value).toEqual({ end: false, count: 13, beads: beadsFor(999)(11), same: false })
    expect(card.more.value).toMatchObject({ count: 15, beads: beadsFor(999)(13) })
    await rest()
    expect(card.fewer.value).toMatchObject({ count: 13, beads: beadsFor(999)(13) })
    expect(card.more.value).toMatchObject({ count: 15, beads: beadsFor(999)(15) })
  })

  it('shows the ends of the range in place of a neighbour', async () => {
    const low = neighbours({ start: 1 })
    low.shown.value = true
    await rest()
    expect(low.fewer.value).toEqual({ end: true, count: 0 })
    const high = neighbours({ start: 15, most: 15 })
    high.shown.value = true
    await rest()
    expect(high.more.value).toEqual({ end: true, count: 16 })
  })

  it('marks a neighbour that gives the beads shown, as where only 9 codes are left', async () => {
    const card = neighbours({ start: 9, cap: 9 })
    card.shown.value = true
    await rest()
    expect(card.more.value).toMatchObject({ count: 10, same: true })
    expect(card.fewer.value).toMatchObject({ count: 8, same: false })
  })

  it('shows no beads, and works none out, past the Colors slider last mark (ticket 1253)', async () => {
    const card = neighbours({ start: NEIGHBOUR_PREVIEWS_UP_TO })
    card.shown.value = true
    await rest()
    expect(card.previews.value).toBe(true)
    expect(card.more.value).toMatchObject({ count: NEIGHBOUR_PREVIEWS_UP_TO + 1, beads: beadsFor(999)(NEIGHBOUR_PREVIEWS_UP_TO + 1) })
    card.beadsAt.mockClear()
    card.set(NEIGHBOUR_PREVIEWS_UP_TO + 1)
    await rest()
    expect(card.previews.value).toBe(false)
    expect(card.beadsAt).not.toHaveBeenCalled()
  })

  it('shows no beads while fewer colors are found than asked (ticket 1253)', async () => {
    const card = neighbours({ start: 12, cap: 9 })
    card.shown.value = true
    await rest()
    expect(card.previews.value).toBe(false)
    expect(card.beadsAt).not.toHaveBeenCalled()
  })

  it('draws the beads again when the beads shown change at the same count (ticket 1253)', async () => {
    const card = neighbours()
    card.shown.value = true
    await rest()
    card.beadsAt.mockImplementation(async (at: number) => [[{ color: `#a${String(at).padStart(5, '0')}` }]])
    card.beadsShown.value = [[{ color: '#ffffff' }]]
    await rest()
    expect(card.fewer.value).toMatchObject({ count: 11, beads: [[{ color: '#a00011' }]] })
  })
})
