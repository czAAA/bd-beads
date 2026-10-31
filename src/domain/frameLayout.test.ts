// @vitest-environment node
import { describe, expect, it } from 'vitest'
import chart from './fixtures/warpedSquareChart.json'
import { fringeLayout, kaleidocycleLayout, kiteLayout, kiteWingBeads, layoutNeighbors, layoutPositionAt, roundsLayout, starLayout, type FrameLayout, type LayoutPoint, type LayoutPosition } from './frameLayout'

/** A Delica 11/0's depth across the thread over its pitch along it (1.6 mm over 1.3 mm). */
const DELICA = 1.6 / 1.3
/** The depths the round shapes are checked at: a Delica, a Cube and a Round 11/0. */
const DEPTHS = [DELICA, 1, 2.2 / 1.65]

/** How many positions each round holds, from the centre out. */
const roundSizes = (corners: 3 | 4, rounds: number) => rowSizes(roundsLayout(corners, rounds, DELICA))

/** How many positions each round or row of a layout holds, from the first; of one part only, when given. */
function rowSizes(layout: FrameLayout, part?: number): number[] {
  const sizes: number[] = []
  for (const { row, panel } of layout.positions) {
    if (part === undefined || layout.panels[panel]!.part === part) sizes[row] = (sizes[row] ?? 0) + 1
  }
  return sizes
}

/** A bead's outline: one width across its panel and the layout's bead depth out from the centre, turned to its panel. */
function outlineOf({ x, y, angle }: LayoutPosition, depth: number): LayoutPoint[] {
  const along = { x: Math.cos(angle) / 2, y: Math.sin(angle) / 2 }
  const out = { x: (-Math.sin(angle) * depth) / 2, y: (Math.cos(angle) * depth) / 2 }
  return [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ].map(([a, o]) => ({ x: x + a! * along.x + o! * out.x, y: y + a! * along.y + o! * out.y }))
}

/** Whether two convex outlines (a segment is one of two points) share more than an edge or a corner. */
function overlap(a: readonly LayoutPoint[], b: readonly LayoutPoint[]): boolean {
  const axes = [a, b].flatMap((shape) =>
    shape.map((point, index) => {
      const next = shape[(index + 1) % shape.length]!
      return { x: point.y - next.y, y: next.x - point.x }
    }),
  )
  return axes.every((axis) => {
    const length = Math.hypot(axis.x, axis.y)
    if (length === 0) return true
    const project = (shape: readonly LayoutPoint[]) => shape.map(({ x, y }) => (x * axis.x + y * axis.y) / length)
    const [pa, pb] = [project(a), project(b)]
    return Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) > 1e-6
  })
}

/** The pairs of beads whose outlines overlap. */
function overlapping(layout: FrameLayout): string[] {
  const outlines = layout.positions.map((position) => outlineOf(position, layout.beadDepth))
  return layout.positions.flatMap((a, index) =>
    layout.positions.slice(index + 1).flatMap((b, after) => (overlap(outlines[index]!, outlines[index + 1 + after]!) ? [`${a.row}:${a.column} ${b.row}:${b.column}`] : [])),
  )
}

/** The beads whose outline a Seam crosses. */
function crossingSeams(layout: FrameLayout): string[] {
  return layout.positions.flatMap((position) => {
    const outline = outlineOf(position, layout.beadDepth)
    return layout.seams.some((seam) => overlap(outline, seam)) ? [`${position.row}:${position.column}`] : []
  })
}

/** Whether every position has its own name and no two beads overlap. */
function sharesNothing(layout: FrameLayout): void {
  const { positions } = layout
  expect(new Set(positions.map(({ row, column }) => `${row}:${column}`)).size).toBe(positions.length)
  expect(overlapping(layout)).toEqual([])
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

/** A bead's column on its panel: how far along the panel's side it stands from the layout's centre, in bead widths. */
function columnOf(layout: FrameLayout, { x, y, angle }: LayoutPosition): number {
  return Math.round(((x - layout.centre.x) * Math.cos(angle) + (y - layout.centre.y) * Math.sin(angle)) * 1000) / 1000
}

describe('a Warped Square charted as a bead artist charts it (ticket 0723)', () => {
  // The reference chart: 10 rounds, 220 beads, each centre in bead widths from the middle, beads 52 px deep to 42 wide.
  const square = roundsLayout(4, 10, chart.beadDepth)

  it('stacks each side\'s beads in columns of 5, 5, 4, 4, 3, 3, 2, 2, 1, 1 out from its middle, as the chart shows', () => {
    for (const panel of [0, 1, 2, 3]) {
      const lengths = new Map<number, number>()
      for (const position of square.positions.filter((each) => each.panel === panel)) {
        const column = columnOf(square, position)
        lengths.set(column, (lengths.get(column) ?? 0) + 1)
      }
      expect([...lengths.entries()].sort(([a], [b]) => a - b).map(([, length]) => length)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1])
    }
  })

  it('puts every bead within 2 px of a bead of the chart, one bead to one', () => {
    const left = chart.centres.map(([x, y]) => ({ x: x!, y: y! }))
    let worst = 0
    for (const { x, y } of square.positions) {
      const dx = x - square.centre.x
      const dy = y - square.centre.y
      const nearest = left.reduce((best, point, index) => (Math.hypot(point.x - dx, point.y - dy) < Math.hypot(left[best]!.x - dx, left[best]!.y - dy) ? index : best), 0)
      worst = Math.max(worst, Math.hypot(left[nearest]!.x - dx, left[nearest]!.y - dy))
      left.splice(nearest, 1)
    }
    expect(left).toEqual([])
    expect(worst * 42).toBeLessThanOrEqual(2.001)
  })

  it('packs its beads with no two overlapping and none across a Seam, leaving gaps along the diagonals', () => {
    expect(overlapping(square)).toEqual([])
    expect(crossingSeams(square)).toEqual([])
    // A column's beads touch end to end, a bead deep apart.
    const middle = square.positions.filter((position) => position.panel === 0 && columnOf(square, position) === 0).map(({ y }) => y).sort((a, b) => a - b)
    expect(middle[1]! - middle[0]!).toBeCloseTo(chart.beadDepth, 6)
    expect(square.beadDepth).toBe(chart.beadDepth)
  })

  it('leaves no empty cell inside a triangle: every bead but those at its edge touches a bead on either side', () => {
    for (const position of square.positions.filter(({ row }) => row < 8)) {
      const column = columnOf(square, position)
      const beside = layoutNeighbors(square, position).map((name) => square.positions.find(({ row, column: place }) => row === name.row && place === name.column)!)
      const sideways = beside.filter((other) => other.panel === position.panel).map((other) => Math.round(columnOf(square, other) - column))
      if (Math.abs(column) < position.row) expect(new Set(sideways.filter((step) => step !== 0))).toEqual(new Set([1, -1]))
    }
  })
})

describe('a layout built by Rounds (spec 0590, ticket 0592)', () => {
  it('gives a peyote Triangle 3, 6, 9… beads a round and a Warped Square 4, 8, 12…', () => {
    expect(roundSizes(3, 6)).toEqual([3, 6, 9, 12, 15, 18])
    expect(roundSizes(4, 5)).toEqual([4, 8, 12, 16, 20])
  })

  it('puts each round\'s beads on its panels in equal shares, one bead to one panel', () => {
    const layout = roundsLayout(3, 4, DELICA)
    const lastRound = layout.positions.filter(({ row }) => row === 3)
    expect([0, 1, 2].map((panel) => lastRound.filter((position) => position.panel === panel).length)).toEqual([4, 4, 4])
    expect(layout.panels).toEqual([0, 1, 2].map(() => ({ part: 0, order: 0 })))
    expect(layout.joins).toEqual([])
  })

  it('shares no position between panels: every bead has its own place, none overlaps another and none crosses a Seam', () => {
    for (const depth of DEPTHS) {
      for (const corners of [3, 4] as const) {
        const layout = roundsLayout(corners, 8, depth)
        sharesNothing(layout)
        expect(crossingSeams(layout)).toEqual([])
      }
    }
  })

  it('stacks a column\'s beads a bead deep apart, so a Triangle and a Warped Square pack alike in any Bead', () => {
    for (const depth of DEPTHS) {
      const triangle = roundsLayout(3, 6, depth)
      const middle = triangle.positions.filter((position) => position.panel === 0 && Math.abs(columnOf(triangle, position)) < 1e-3).map(({ y }) => y).sort((a, b) => a - b)
      expect(middle).toHaveLength(3)
      expect(middle[1]! - middle[0]!).toBeCloseTo(depth, 6)
      expect(triangle.beadDepth).toBe(depth)
    }
  })

  it('stands taller in a deeper Bead, keeping every bead\'s name', () => {
    const [squat, tall] = [DELICA, 2.2 / 1.65].map((depth) => roundsLayout(4, 6, depth))
    expect(tall.height).toBeGreaterThan(squat.height)
    expect(tall.positions.map(({ row, column, panel }) => `${row}:${column}:${panel}`)).toEqual(squat.positions.map(({ row, column, panel }) => `${row}:${column}:${panel}`))
  })

  it('draws each panel\'s beads at the angle of its side', () => {
    const triangle = roundsLayout(3, 3, DELICA)
    const angles = [0, 1, 2].map((panel) => triangle.positions.find((position) => position.panel === panel)!.angle)
    expect(angles.map((angle) => Math.round((angle * 180) / Math.PI))).toEqual([0, 120, 240])
    expect(new Set(roundsLayout(4, 3, DELICA).positions.map(({ angle }) => Math.round((angle * 180) / Math.PI)))).toEqual(new Set([0, 90, 180, 270]))
  })

  it('lies inside its bounding rectangle, from 0, 0', () => {
    const layout = roundsLayout(3, 5, DELICA)
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
      const layout = roundsLayout(corners, 7, DELICA)
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
    const layout = roundsLayout(4, 4, DELICA)
    const bead = layout.positions[20]!
    expect(layoutPositionAt(layout, bead.x + 0.2, bead.y - 0.2)).toEqual({ row: bead.row, column: bead.column })
    // The corner of the bounding rectangle is outside a Triangle; the centre is where the Seams meet.
    const triangle = roundsLayout(3, 4, DELICA)
    expect(layoutPositionAt(triangle, 0.1, 0.1)).toBeUndefined()
    expect(layoutPositionAt(triangle, triangle.centre.x, triangle.centre.y)).toBeUndefined()
  })

  it('knows the beads that touch one, across a Seam too', () => {
    const layout = roundsLayout(3, 3, DELICA)
    // The last bead of panel 0's second round and the first of panel 1's are a corner pair.
    expect(layoutNeighbors(layout, { row: 1, column: 1 })).toContainEqual({ row: 1, column: 2 })
    // Beads of one round on one side sit two apart: the rounds either side lie between them.
    expect(layoutNeighbors(layout, { row: 2, column: 0 })).not.toContainEqual({ row: 2, column: 1 })
    expect(layoutNeighbors(layout, { row: 2, column: 0 })).toContainEqual({ row: 1, column: 0 })
  })
})

describe('a Star (ticket 0593)', () => {
  it('is five Warped Square arms of Part size rounds, each 4, 8, 12… beads a round, drawn flat as rhombi (inferred: no source charts a flat Star)', () => {
    const star = starLayout(5, DELICA)
    expect(new Set(star.panels.map(({ part }) => part))).toEqual(new Set([0, 1, 2, 3, 4]))
    for (const part of [0, 1, 2, 3, 4]) expect(rowSizes(star, part)).toEqual([4, 8, 12, 16, 20])
    expect(star.positions).toHaveLength(5 * 60)
  })

  it('beads each arm in turn, then zips them pair by pair, the last seam closed last', () => {
    const star = starLayout(4, DELICA)
    expect(star.panels.filter(({ part }) => part === 3)).toEqual([0, 1, 2, 3].map(() => ({ part: 3, order: 3 })))
    expect(star.joins).toEqual([
      { step: 'zip', parts: [0, 1] },
      { step: 'zip', parts: [1, 2] },
      { step: 'zip', parts: [2, 3] },
      { step: 'zip', parts: [3, 4] },
      { step: 'close', parts: [4, 0] },
    ])
  })

  it('shares no position between panels or arms, lies inside its bounding rectangle, and packs no bead across a Seam', () => {
    for (const depth of DEPTHS) {
      sharesNothing(starLayout(7, depth))
      liesInside(starLayout(7, depth))
      expect(crossingSeams(starLayout(7, depth))).toEqual([])
    }
  })

  it('mirrors onto itself left to right, and turns onto itself by a fifth, as Mirror finds each bead\'s counterpart', () => {
    for (const depth of DEPTHS) {
      const star = starLayout(5, depth)
      const holds = ({ x, y }: LayoutPoint) => star.positions.some((other) => Math.hypot(other.x - x, other.y - y) < 1e-6)
      const turn = (2 * Math.PI) / 5
      for (const { x, y } of star.positions) {
        const [dx, dy] = [x - star.centre.x, y - star.centre.y]
        expect(holds({ x: star.centre.x - dx, y })).toBe(true)
        expect(holds({ x: star.centre.x + dx * Math.cos(turn) - dy * Math.sin(turn), y: star.centre.y + dx * Math.sin(turn) + dy * Math.cos(turn) })).toBe(true)
      }
    }
  })

  it('has no bead at its centre, where the arms meet, nor between two arms\' tips', () => {
    const star = starLayout(6, DELICA)
    expect(layoutPositionAt(star, star.centre.x, star.centre.y)).toBeUndefined()
    // Straight down from the centre lies the notch between the two lower arms.
    expect(layoutPositionAt(star, star.centre.x, star.height - 0.5)).toBeUndefined()
  })

  it('stands with an arm straight up', () => {
    const star = starLayout(6, DELICA)
    const top = star.positions.reduce((highest, position) => (position.y < highest.y ? position : highest))
    expect(star.panels[top.panel]!.part).toBe(0)
    expect(Math.abs(top.x - star.centre.x)).toBeLessThan(1)
  })

  it('fills from one arm into the next, where their beads touch', () => {
    const star = starLayout(4, DELICA)
    const parts = (positions: { row: number; column: number }[]) =>
      new Set(positions.map((neighbour) => star.panels[star.positions.find(({ row, column }) => row === neighbour.row && column === neighbour.column)!.panel]!.part))
    const outer = star.positions.filter(({ row, panel }) => row === 3 && star.panels[panel]!.part === 0)
    expect(outer.some((position) => parts(layoutNeighbors(star, position)).has(1))).toBe(true)
  })

  it('keeps a bead\'s name when the Part size grows', () => {
    const small = starLayout(3, DELICA)
    const big = starLayout(6, DELICA)
    for (const position of small.positions) {
      expect(big.positions.find(({ row, column }) => row === position.row && column === position.column)?.panel).toBe(position.panel)
    }
  })
})

describe('a Kaleidocycle (ticket 0593)', () => {
  it('is a hexagon of six peyote Triangles of Part size beads a side, each 3, 6, 9… beads a round', () => {
    const cycle = kaleidocycleLayout(9, DELICA)
    expect(new Set(cycle.panels.map(({ part }) => part))).toEqual(new Set([0, 1, 2, 3, 4, 5]))
    for (const part of [0, 1, 2, 3, 4, 5]) expect(rowSizes(cycle, part)).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27])
  })

  it('has its hole Off-shape: no bead at its middle', () => {
    for (const size of [3, 9, 15]) {
      const cycle = kaleidocycleLayout(size, DELICA)
      expect(layoutPositionAt(cycle, cycle.centre.x, cycle.centre.y)).toBeUndefined()
      expect(layoutPositionAt(cycle, cycle.centre.x + 0.8, cycle.centre.y)).toBeUndefined()
    }
  })

  it('shares no position between triangles, lies inside its bounding rectangle, and packs no bead across a Seam', () => {
    for (const depth of DEPTHS) {
      sharesNothing(kaleidocycleLayout(6, depth))
      liesInside(kaleidocycleLayout(6, depth))
      expect(crossingSeams(kaleidocycleLayout(6, depth))).toEqual([])
    }
  })

  it('beads the triangles first, then (inferred from the primer) zips each into its strip, hinges the mirror pairs and closes the ring', () => {
    const cycle = kaleidocycleLayout(5, DELICA)
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
