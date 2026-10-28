// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fringeLayout, kaleidocycleLayout, kiteLayout, kiteWingBeads, layoutNeighbors, layoutPositionAt, roundsLayout, starLayout, type FrameLayout } from './frameLayout'

/** How many positions each round holds, from the centre out. */
const roundSizes = (corners: 3 | 4, rounds: number) => rowSizes(roundsLayout(corners, rounds))

/** How many positions each round or row of a layout holds, from the first; of one part only, when given. */
function rowSizes(layout: FrameLayout, part?: number): number[] {
  const sizes: number[] = []
  for (const { row, panel } of layout.positions) {
    if (part === undefined || layout.panels[panel]!.part === part) sizes[row] = (sizes[row] ?? 0) + 1
  }
  return sizes
}

/** Whether every position has its own name and no two beads overlap. */
function sharesNothing({ positions }: FrameLayout): void {
  expect(new Set(positions.map(({ row, column }) => `${row}:${column}`)).size).toBe(positions.length)
  let closest = Infinity
  positions.forEach((a, index) => {
    for (const b of positions.slice(index + 1)) closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y))
  })
  expect(closest).toBeGreaterThan(0.99)
}

/** Whether every bead lies inside the bounding rectangle. */
function liesInside(layout: FrameLayout): void {
  for (const { x, y } of layout.positions) {
    expect(x).toBeGreaterThan(0)
    expect(y).toBeGreaterThan(0)
    expect(x).toBeLessThan(layout.width)
    expect(y).toBeLessThan(layout.height)
  }
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
    expect(layout.panels).toEqual([0, 1, 2].map(() => ({ part: 0, order: 0 })))
    expect(layout.joins).toEqual([])
  })

  it('shares no position between panels: every bead has its own place, and none overlaps another', () => {
    for (const corners of [3, 4] as const) {
      const { positions } = roundsLayout(corners, 8)
      const keys = new Set(positions.map(({ row, column }) => `${row}:${column}`))
      expect(keys.size).toBe(positions.length)
      const closest = Math.min(...positions.flatMap((a, index) => positions.slice(index + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))))
      expect(closest).toBeGreaterThan(0.99)
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

describe('a Star (ticket 0593)', () => {
  it('is five Warped Square arms of Part size rounds, each 4, 8, 12… beads a round, drawn flat as rhombi (inferred: no source charts a flat Star)', () => {
    const star = starLayout(5)
    expect(new Set(star.panels.map(({ part }) => part))).toEqual(new Set([0, 1, 2, 3, 4]))
    for (const part of [0, 1, 2, 3, 4]) expect(rowSizes(star, part)).toEqual([4, 8, 12, 16, 20])
    expect(star.positions).toHaveLength(5 * 60)
  })

  it('beads each arm in turn, then zips them pair by pair, the last seam closed last', () => {
    const star = starLayout(4)
    expect(star.panels.filter(({ part }) => part === 3)).toEqual([0, 1, 2, 3].map(() => ({ part: 3, order: 3 })))
    expect(star.joins).toEqual([
      { step: 'zip', parts: [0, 1] },
      { step: 'zip', parts: [1, 2] },
      { step: 'zip', parts: [2, 3] },
      { step: 'zip', parts: [3, 4] },
      { step: 'close', parts: [4, 0] },
    ])
  })

  it('shares no position between panels or arms, and lies inside its bounding rectangle', () => {
    sharesNothing(starLayout(7))
    liesInside(starLayout(7))
  })

  it('has no bead at its centre, where the arms meet, nor between two arms\' tips', () => {
    const star = starLayout(6)
    expect(layoutPositionAt(star, star.centre.x, star.centre.y)).toBeUndefined()
    // Straight down from the centre lies the notch between the two lower arms.
    expect(layoutPositionAt(star, star.centre.x, star.height - 0.5)).toBeUndefined()
  })

  it('stands with an arm straight up', () => {
    const star = starLayout(6)
    const top = star.positions.reduce((highest, position) => (position.y < highest.y ? position : highest))
    expect(star.panels[top.panel]!.part).toBe(0)
    expect(Math.abs(top.x - star.centre.x)).toBeLessThan(1)
  })

  it('fills from one arm into the next, where their beads touch', () => {
    const star = starLayout(4)
    const parts = (positions: { row: number; column: number }[]) =>
      new Set(positions.map((neighbour) => star.panels[star.positions.find(({ row, column }) => row === neighbour.row && column === neighbour.column)!.panel]!.part))
    const outer = star.positions.filter(({ row, panel }) => row === 3 && star.panels[panel]!.part === 0)
    expect(outer.some((position) => parts(layoutNeighbors(star, position)).has(1))).toBe(true)
  })

  it('keeps a bead\'s name when the Part size grows', () => {
    const small = starLayout(3)
    const big = starLayout(6)
    for (const position of small.positions) {
      expect(big.positions.find(({ row, column }) => row === position.row && column === position.column)?.panel).toBe(position.panel)
    }
  })
})

describe('a Kaleidocycle (ticket 0593)', () => {
  it('is a hexagon of six peyote Triangles of Part size beads a side, each 3, 6, 9… beads a round', () => {
    const cycle = kaleidocycleLayout(9)
    expect(new Set(cycle.panels.map(({ part }) => part))).toEqual(new Set([0, 1, 2, 3, 4, 5]))
    for (const part of [0, 1, 2, 3, 4, 5]) expect(rowSizes(cycle, part)).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27])
  })

  it('has its hole Off-shape: no bead at its middle', () => {
    for (const size of [3, 9, 15]) {
      const cycle = kaleidocycleLayout(size)
      expect(layoutPositionAt(cycle, cycle.centre.x, cycle.centre.y)).toBeUndefined()
      expect(layoutPositionAt(cycle, cycle.centre.x + 0.8, cycle.centre.y)).toBeUndefined()
    }
  })

  it('shares no position between triangles, and lies inside its bounding rectangle', () => {
    sharesNothing(kaleidocycleLayout(6))
    liesInside(kaleidocycleLayout(6))
  })

  it('beads the triangles first, then (inferred from the primer) zips each into its strip, hinges the mirror pairs and closes the ring', () => {
    const cycle = kaleidocycleLayout(5)
    expect(cycle.panels.filter(({ part }) => part === 4).map(({ order }) => order)).toEqual([4, 4, 4])
    expect(cycle.joins.map(({ step }) => step)).toEqual(['zip', 'zip', 'zip', 'zip', 'zip', 'zip', 'hinge', 'hinge', 'hinge', 'close', 'close', 'close'])
    expect(cycle.joins.at(-1)).toEqual({ step: 'close', parts: [5, 0] })
  })
})

describe('a Kite (ticket 0593)', () => {
  it('starts with a two-bead pair at its point, and has a pair at the centre of every row', () => {
    const kite = kiteLayout(12)
    const sizes = rowSizes(kite)
    expect(sizes.slice(0, 2)).toEqual([2, 2])
    for (let row = 0; row < 12; row += 1) {
      const centre = kite.positions.filter((position) => position.row === row && position.column < 2)
      expect(centre.map(({ panel }) => panel).sort()).toEqual([0, 1])
    }
  })

  it('grows a bead a wing a row to its widest row a fifth down, then (inferred: the reference gives no counts) shrinks a bead every fourth row to a pair', () => {
    expect(Array.from({ length: 12 }, (_unused, row) => kiteWingBeads(row, 12))).toEqual([0, 0, 1, 2, 2, 2, 2, 1, 1, 1, 1, 0])
    expect(rowSizes(kiteLayout(12))).toEqual([2, 2, 4, 6, 6, 6, 6, 4, 4, 4, 4, 2])
    expect(kiteWingBeads(20, 21)).toBe(0)
  })

  it('is shorter above its widest row than below it, as a kite is', () => {
    const kite = kiteLayout(21)
    const widest = kite.positions.reduce((outermost, position) => (position.x > outermost.x ? position : outermost))
    expect(widest.y).toBeLessThan(kite.height / 2)
  })

  it('is two peyote wings, square to each other, meeting at a spine down its middle', () => {
    const kite = kiteLayout(9)
    expect(kite.panels).toHaveLength(2)
    expect(new Set(kite.positions.map(({ panel, angle }) => `${panel}:${Math.round((angle * 180) / Math.PI)}`))).toEqual(new Set(['0:135', '1:45']))
    for (const { x, panel } of kite.positions) expect(panel === 0 ? x < kite.centre.x : x > kite.centre.x).toBe(true)
    expect(kite.seams).toHaveLength(1)
    expect(kite.height).toBeGreaterThan(kite.width)
  })

  it('shares no position between its wings, lies inside its bounding rectangle, and refuses a press on its spine', () => {
    const kite = kiteLayout(15)
    sharesNothing(kite)
    liesInside(kite)
    // The spine at a row's point, just above its centre pair, between it and the row before.
    const [left, right] = [0, 1].map((column) => kite.positions.find((position) => position.row === 5 && position.column === column)!)
    expect(layoutPositionAt(kite, (left!.x + right!.x) / 2, (left!.y + right!.y) / 2 - 0.7)).toBeUndefined()
  })

  it('fills across the spine, where the centre pair touch', () => {
    expect(layoutNeighbors(kiteLayout(6), { row: 3, column: 0 })).toContainEqual({ row: 3, column: 1 })
  })
})

describe('a Fringe earring (ticket 0597)', () => {
  const earring = (fringeStyle: 'straight' | 'v' = 'straight', topWidth = 8, topRows = 5, fringeLength = 12) => fringeLayout({ topWidth, topRows, fringeStyle, fringeLength })
  /** The beads of each strand, from the first on the left. */
  const strandLengths = (layout: FrameLayout) => layout.panels.flatMap((panel, index) => (panel.strand ? [layout.positions.filter((position) => position.panel === index).length] : []))
  const top = (layout: FrameLayout) => layout.positions.filter(({ panel }) => panel === 0)

  it('has a brick-stitch top worked from its base row up, each row one bead shorter', () => {
    expect(rowSizes({ ...earring(), positions: top(earring()) })).toEqual([8, 7, 6, 5, 4])
    // Each row sits half a bead in from the one under it, and above it.
    const [base, second] = [0, 1].map((row) => top(earring()).filter((position) => position.row === row))
    expect(second![0]!.x - base![0]!.x).toBeCloseTo(0.5)
    expect(second![0]!.y).toBeLessThan(base![0]!.y)
  })

  it('hangs a strand under each bead of the base row, all as long as the Fringe length when straight', () => {
    expect(strandLengths(earring('straight'))).toEqual([12, 12, 12, 12, 12, 12, 12, 12])
    const layout = earring()
    const base = top(layout).filter(({ row }) => row === 0)
    for (const [strand, bead] of base.entries()) {
      const hanging = layout.positions.filter(({ panel }) => panel === strand + 1)
      expect(hanging.every(({ x, y }) => Math.abs(x - bead.x) < 1e-9 && y > bead.y)).toBe(true)
    }
  })

  it('makes a V of the strands, the middle one or pair the Fringe length and each strand out two beads shorter', () => {
    expect(strandLengths(earring('v', 8, 5, 12))).toEqual([6, 8, 10, 12, 12, 10, 8, 6])
    // The card's V fringe: a top of 7 and 6 rows, 27 beads, and 60 in its strands.
    const card = earring('v', 7, 6, 12)
    expect(strandLengths(card)).toEqual([6, 8, 10, 12, 10, 8, 6])
    expect(card.positions).toHaveLength(87)
    // A short fringe on a wide top keeps a bead on every strand.
    expect(strandLengths(earring('v', 9, 3, 4))).toEqual([1, 1, 1, 2, 4, 2, 1, 1, 1])
  })

  it('is one part with its strands, a Seam between the top and the strands, and no joins', () => {
    const layout = earring()
    expect(layout.panels).toEqual([{ part: 0, order: 0 }, ...[1, 2, 3, 4, 5, 6, 7, 8].map((part) => ({ part, order: part, strand: true }))])
    expect(layout.joins).toEqual([])
    expect(layout.seams).toHaveLength(1)
    const base = top(layout).find(({ row, column }) => row === 0 && column === 3)!
    const hanging = layout.positions.find(({ panel, y }) => panel === 4 && y > base.y)!
    expect(layoutPositionAt(layout, base.x, (base.y + hanging.y) / 2)).toBeUndefined()
  })

  it('shares no position, lies inside its bounding rectangle, and refuses a press beside a short strand', () => {
    const layout = earring('v')
    sharesNothing(layout)
    liesInside(layout)
    expect(layoutPositionAt(layout, 0.71, layout.height - 0.71)).toBeUndefined()
  })

  it('keeps a bead\'s name when the top or the strands change size', () => {
    const name = ({ row, column }: { row: number; column: number }) => `${row}:${column}`
    const small = new Set(earring('straight', 8, 5, 12).positions.map(name))
    const big = new Set(earring('straight', 10, 7, 20).positions.map(name))
    expect([...small].every((key) => big.has(key))).toBe(true)
  })

  it('fills down a strand and up into the top, where beads touch', () => {
    const layout = earring()
    const firstOfStrand = layout.positions.filter(({ panel }) => panel === 1).sort((a, b) => a.y - b.y)[0]!
    expect(layoutNeighbors(layout, firstOfStrand)).toContainEqual({ row: 0, column: 0 })
  })
})
