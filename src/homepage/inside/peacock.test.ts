import { describe, expect, it } from 'vitest'
import { CUFF_EYE_BEADS, PEACOCK_CUFF, PEACOCK_RING, RING_EYE_BEADS, peacockPart } from './peacock'

/** How many beads of each part a drawing's first `length` beads hold. */
function counts(rows: readonly string[], length: number): Record<string, number> {
  const found: Record<string, number> = {}
  for (const row of rows) for (const part of row.slice(0, length)) found[part] = (found[part] ?? 0) + 1
  return found
}

describe("the demo's peacock feather (ticket 0831)", () => {
  it("draws the ring's eye as the ticket maps it, every 9 beads along the band", () => {
    const eye = ['...GGG...', '..GDDG...', '..DTTTD..', '.GTBBTG..', '..DBNBD..', '..DTTD...', '...GGG...']
    expect(PEACOCK_RING.rows.map((row) => row.slice(0, 9))).toEqual(eye)
    expect(PEACOCK_RING.rows).toEqual(eye.map((row) => row.repeat(4)))
    expect(counts(PEACOCK_RING.rows, 9)).toEqual({ '.': 33, G: 10, D: 8, T: 7, B: 4, N: 1 })
    expect(RING_EYE_BEADS).toBe(30)
  })

  it('draws the cuff 48 long and 23 wide, three eyes of 263 beads, each with its barbs', () => {
    expect(PEACOCK_CUFF.rows).toHaveLength(23)
    expect(PEACOCK_CUFF.rows.every((row) => row.length === 48)).toBe(true)
    expect(counts(PEACOCK_CUFF.rows, 16)).toEqual({ '.': 105, g: 48, G: 74, D: 64, T: 46, B: 24, N: 7 })
    expect(PEACOCK_CUFF.rows.every((row) => row === row.slice(0, 16).repeat(3))).toBe(true)
    expect(CUFF_EYE_BEADS).toBe(263)
  })

  it("puts the cuff's pupil a little under the middle of its eye", () => {
    expect(PEACOCK_CUFF.rows[12]!.slice(0, 16)).toBe('GGDTTBBNNBBTTDGG')
    expect(peacockPart({ line: 12, along: 7 }, PEACOCK_CUFF)).toBe('N')
  })
})
