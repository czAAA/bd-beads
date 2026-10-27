// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { layoutNeighbors, layoutPositionAt, roundsLayout } from './frameLayout'

/** How many positions each round holds, from the centre out. */
const roundSizes = (corners: 3 | 4, rounds: number) => {
  const sizes: number[] = []
  for (const { row } of roundsLayout(corners, rounds).positions) sizes[row] = (sizes[row] ?? 0) + 1
  return sizes
}

describe('a layout built by Rounds (spec 0590, ticket 0592)', () => {
  it('gives a peyote Triangle 3, 6, 9… beads a round and a Warped Square 4, 8, 12…', () => {
    expect(roundSizes(3, 6)).toEqual([3, 6, 9, 12, 15, 18])
    expect(roundSizes(4, 5)).toEqual([4, 8, 12, 16, 20])
  })

  it('puts each round\'s beads on its panels in equal shares, one bead to one panel', () => {
    const layout = roundsLayout(3, 4)
    const lastRound = layout.positions.filter(({ row }) => row === 3)
    expect([0, 1, 2].map((panel) => lastRound.filter((position) => position.panel === panel).length)).toEqual([4, 4, 4])
    expect(layout.panels).toBe(3)
  })

  it('shares no position between panels: every bead has its own place, and none overlaps another', () => {
    for (const corners of [3, 4] as const) {
      const { positions } = roundsLayout(corners, 8)
      const keys = new Set(positions.map(({ row, column }) => `${row}:${column}`))
      expect(keys.size).toBe(positions.length)
      for (const a of positions) {
        for (const b of positions) {
          if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.99)
        }
      }
    }
  })

  it('draws each panel\'s beads at the angle of its side', () => {
    const triangle = roundsLayout(3, 3)
    const angles = [0, 1, 2].map((panel) => triangle.positions.find((position) => position.panel === panel)!.angle)
    expect(angles.map((angle) => Math.round((angle * 180) / Math.PI))).toEqual([0, 120, 240])
    expect(new Set(roundsLayout(4, 3).positions.map(({ angle }) => Math.round((angle * 180) / Math.PI)))).toEqual(new Set([0, 90, 180, 270]))
  })

  it('lies inside its bounding rectangle, from 0, 0', () => {
    const layout = roundsLayout(3, 5)
    for (const { x, y } of layout.positions) {
      expect(x).toBeGreaterThan(0)
      expect(y).toBeGreaterThan(0)
      expect(x).toBeLessThan(layout.width)
      expect(y).toBeLessThan(layout.height)
    }
    // A Triangle stands on its side: wider than tall.
    expect(layout.width).toBeGreaterThan(layout.height)
  })

  it('sits in the middle of its bounding rectangle, which hugs its beads and not the empty points of its corners', () => {
    for (const corners of [3, 4] as const) {
      const layout = roundsLayout(corners, 7)
      const xs = layout.positions.map(({ x }) => x)
      const ys = layout.positions.map(({ y }) => y)
      // No bead centre is more than a bead from the edge, and the room left is the same on both sides.
      expect(Math.min(...xs)).toBeLessThan(1)
      expect(Math.min(...ys)).toBeLessThan(1)
      expect(Math.min(...xs)).toBeCloseTo(layout.width - Math.max(...xs), 5)
      expect(Math.min(...ys)).toBeCloseTo(layout.height - Math.max(...ys), 5)
    }
  })

  it('finds the bead under a point, and none on a Seam or Off-shape', () => {
    const layout = roundsLayout(4, 4)
    const bead = layout.positions[20]!
    expect(layoutPositionAt(layout, bead.x + 0.2, bead.y - 0.2)).toEqual({ row: bead.row, column: bead.column })
    // The corner of the bounding rectangle is outside a Triangle; the centre is where the Seams meet.
    const triangle = roundsLayout(3, 4)
    expect(layoutPositionAt(triangle, 0.1, 0.1)).toBeUndefined()
    expect(layoutPositionAt(triangle, triangle.centre.x, triangle.centre.y)).toBeUndefined()
  })

  it('knows the beads that touch one, across a Seam too', () => {
    const layout = roundsLayout(3, 3)
    // The last bead of panel 0's second round and the first of panel 1's are a corner pair.
    expect(layoutNeighbors(layout, { row: 1, column: 1 })).toContainEqual({ row: 1, column: 2 })
    // Beads of one round on one side sit two apart: the rounds either side lie between them.
    expect(layoutNeighbors(layout, { row: 2, column: 0 })).not.toContainEqual({ row: 2, column: 1 })
    expect(layoutNeighbors(layout, { row: 2, column: 0 })).toContainEqual({ row: 1, column: 0 })
  })
})
