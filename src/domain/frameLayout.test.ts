// @vitest-environment node
import { describe, expect, it } from 'vitest'
import chart from './fixtures/warpedSquareChart.json'
import { fringeLayout, kaleidocycleLayout, type FringeTop, kiteLayout, layoutNeighbors, layoutPositionAt, roundsLayout, starLayout, type FrameLayout, type LayoutPoint, type LayoutPosition } from './frameLayout'

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

describe('a Star of five warped squares centred on its notches (ticket 0875)', () => {
  /** The arm a bead lies on: the one whose direction from the centre its angle points along. */
  const armOf = ({ angle }: LayoutPosition) => Math.round((((angle + Math.PI / 2) / ((2 * Math.PI) / 5)) % 5) + 5) % 5
  /** How far a bead lies along its arm from the centre, and across it (towards the next arm clockwise). */
  const onArm = (star: FrameLayout, position: LayoutPosition) => {
    const [dx, dy] = [position.x - star.centre.x, position.y - star.centre.y]
    return { along: dx * Math.cos(position.angle) + dy * Math.sin(position.angle), across: -dx * Math.sin(position.angle) + dy * Math.cos(position.angle) }
  }

  it('holds 5 R² beads on its face, its bead centres in the box and its tip as far out as the ticket measures them', () => {
    const measured = [
      { size: 3, beads: 45, wide: 10.17, tall: 9.67, tip: 5.35 },
      { size: 5, beads: 125, wide: 17.78, tall: 16.91, tip: 9.35 },
      { size: 10, beads: 500, wide: 36.8, tall: 35, tip: 19.35 },
    ]
    for (const { size, beads, wide, tall, tip } of measured) {
      const star = starLayout(size, DELICA)
      const [xs, ys] = [star.positions.map(({ x }) => x), star.positions.map(({ y }) => y)]
      expect(star.positions).toHaveLength(beads)
      expect(Math.abs(Math.max(...xs) - Math.min(...xs) - wide)).toBeLessThan(0.01)
      expect(Math.abs(Math.max(...ys) - Math.min(...ys) - tall)).toBeLessThan(0.01)
      expect(Math.abs(Math.max(...star.positions.map(({ x, y }) => Math.hypot(x - star.centre.x, y - star.centre.y))) - tip)).toBeLessThan(0.01)
    }
  })

  it('makes each arm straight rows of 1 … R … 1 beads along its ridge, the ridge row\'s first bead 1.347 out', () => {
    const star = starLayout(5, DELICA)
    for (const arm of [0, 1, 2, 3, 4]) {
      const rows = new Map<number, number[]>()
      for (const position of star.positions.filter((each) => armOf(each) === arm)) {
        const { along, across } = onArm(star, position)
        const row = Math.round(across / Math.tan(Math.PI / 5))
        // Every bead lies along its ridge: on its row's straight line.
        expect(Math.abs(across - row * Math.tan(Math.PI / 5))).toBeLessThan(1e-9)
        rows.set(row, [...(rows.get(row) ?? []), along])
      }
      expect([...rows.keys()].sort((a, b) => a - b).map((row) => rows.get(row)!.length)).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1])
      for (const [row, alongs] of rows) expect(Math.min(...alongs)).toBeCloseTo(1.347 + Math.abs(row), 3)
    }
  })

  it('shares no position between panels or squares, lies inside its bounding rectangle, and packs no bead across a Seam', () => {
    for (const depth of DEPTHS) {
      sharesNothing(starLayout(7, depth))
      liesInside(starLayout(7, depth))
      expect(crossingSeams(starLayout(7, depth))).toEqual([])
    }
  })

  it('has 5 Seams, one down each valley from the centre to the notch, where the arms\' outlines meet', () => {
    const star = starLayout(5, DELICA)
    expect(star.seams).toHaveLength(5)
    star.seams.forEach(([from, to], valley) => {
      expect(Math.hypot(from.x - star.centre.x, from.y - star.centre.y)).toBeLessThan(1e-9)
      // Clockwise from straight up: valley j lies between arms j and j + 1.
      const length = Math.hypot(to.x - from.x, to.y - from.y)
      const turn = ((2 * valley + 1) * Math.PI) / 5
      expect((to.x - from.x) / length).toBeCloseTo(Math.sin(turn), 6)
      expect((to.y - from.y) / length).toBeCloseTo(-Math.cos(turn), 6)
      expect(length).toBeCloseTo((1.347 + 4) / Math.cos(Math.PI / 5), 2)
    })
  })

  it('centres each square on a notch: arm j\'s half facing arm j + 1, arm j\'s ridge row and arm j + 1\'s half facing it', () => {
    const star = starLayout(5, DELICA)
    expect(new Set(star.panels.map(({ part }) => part))).toEqual(new Set([0, 1, 2, 3, 4]))
    for (const square of [0, 1, 2, 3, 4]) {
      expect(rowSizes(star, square)).toEqual([2, 4, 6, 8, 5])
      const beads = star.positions.filter(({ panel }) => star.panels[panel]!.part === square)
      for (let round = 1; round < 5; round += 1) {
        const halves = beads.filter(({ row }) => row === round - 1).map((each) => ({ arm: armOf(each), ...onArm(star, each) }))
        expect(halves.filter(({ arm, across }) => arm === square && across > 0)).toHaveLength(round)
        expect(halves.filter(({ arm, across }) => arm === (square + 1) % 5 && across < 0)).toHaveLength(round)
      }
      const ridge = beads.filter(({ row }) => row === 4)
      expect(ridge.every((each) => armOf(each) === square && Math.abs(onArm(star, each).across) < 1e-9)).toBe(true)
    }
  })

  it('beads each square in turn, then zips them along the ridges pair by pair, 5 to 1 last', () => {
    const star = starLayout(4, DELICA)
    expect(star.panels.filter(({ part }) => part === 3)).toEqual([0, 1].map(() => ({ part: 3, order: 3 })))
    expect(star.joins.map(({ step, parts }) => ({ step, parts }))).toEqual([
      { step: 'zip', parts: [0, 1] },
      { step: 'zip', parts: [1, 2] },
      { step: 'zip', parts: [2, 3] },
      { step: 'zip', parts: [3, 4] },
      { step: 'close', parts: [4, 0] },
    ])
    // Squares 1 and 2 meet along arm 2's ridge: square 2's ridge row and square 1's round 3 beside it.
    const zipped = star.joins[1]!.beads!.map((index) => star.positions[index]!)
    expect(zipped.map(({ row, column }) => `${row}:${column}`)).toEqual([0, 1, 2, 3].map((place) => `3:${16 + place}`).concat([3, 4, 5].map((place) => `2:${6 + place}`)))
  })

  it('takes each tip bead as on both front and back, and every other bead as the back\'s too', () => {
    const star = starLayout(5, DELICA)
    const tips = star.back!.shared.map((index) => star.positions[index]!)
    expect(tips.map(({ row, column }) => `${row}:${column}`)).toEqual([0, 1, 2, 3, 4].map((square) => `4:${10 * square + 4}`))
    for (const tip of tips) expect(Math.hypot(tip.x - star.centre.x, tip.y - star.centre.y)).toBeCloseTo(9.347, 3)
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

  it('stands with an arm straight up, square 1\'s ridge', () => {
    const star = starLayout(6, DELICA)
    const top = star.positions.reduce((highest, position) => (position.y < highest.y ? position : highest))
    expect(star.panels[top.panel]!.part).toBe(0)
    expect(Math.abs(top.x - star.centre.x)).toBeLessThan(1e-9)
  })

  it('fills from one square into the next across a ridge and across a valley, where their beads touch', () => {
    const star = starLayout(4, DELICA)
    const parts = (positions: { row: number; column: number }[]) =>
      new Set(positions.map((neighbour) => star.panels[star.positions.find(({ row, column }) => row === neighbour.row && column === neighbour.column)!.panel]!.part))
    const ridge = star.positions.filter(({ row, panel }) => row === 3 && star.panels[panel]!.part === 1)
    expect(ridge.some((position) => parts(layoutNeighbors(star, position)).has(0))).toBe(true)
    const nearCentre = star.positions.find(({ row, column }) => row === 3 && column === 0)!
    expect(parts(layoutNeighbors(star, nearCentre))).toContain(4)
  })

  it('keeps a bead\'s name and square when the Part size changes: a square\'s rounds from its notch', () => {
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

  it('beads the triangles first, then joins them as the Kali Primer does: Strip and Tetra, Mirror pairs, the ring (ticket 0877)', () => {
    const cycle = kaleidocycleLayout(5, DELICA)
    expect(cycle.panels.filter(({ part }) => part === 4).map(({ order }) => order)).toEqual([4, 4, 4])
    expect(cycle.joins.map(({ step }) => step)).toEqual(['tetra', 'tetra', 'tetra', 'tetra', 'tetra', 'tetra', 'pair', 'pair', 'pair', 'ring', 'ring', 'ring'])
    expect(cycle.joins.at(-1)).toEqual({ step: 'ring', parts: [4, 5, 0, 1], beads: [] })
  })
})

describe('a Kite: two peyote wings on a herringbone spine (ticket 0874)', () => {
  /** Each bead's centre from the point, the middle of the first row's pair, in bead widths with y down. */
  const fromPoint = (kite: FrameLayout) => {
    const first = kite.positions.filter(({ row }) => row === 0)
    const point = { x: (first[0]!.x + first[1]!.x) / 2, y: first[0]!.y }
    return kite.positions.map((bead) => ({ ...bead, x: bead.x - point.x, y: bead.y - point.y }))
  }
  /** The box round the bead centres, wide × tall. */
  const box = ({ positions }: FrameLayout) => [Math.max(...positions.map(({ x }) => x)) - Math.min(...positions.map(({ x }) => x)), Math.max(...positions.map(({ y }) => y)) - Math.min(...positions.map(({ y }) => y))]

  it.each([
    [5, [2, 2, 4, 4, 6], 18, [5.77, 4.7]],
    [10, [2, 2, 4, 4, 6, 6, 8, 8, 10, 10], 60, [9.96, 10.57]],
    [21, Array.from({ length: 21 }, (_unused, row) => 2 * Math.ceil((row + 1) / 2)), 242, [22.54, 23.48]],
  ])('at %i rows holds %j beads a row, %i in all, its bead centres in a box of %j', (rows, sizes, total, [wide, tall]) => {
    const kite = kiteLayout(rows, DELICA)
    expect(rowSizes(kite)).toEqual(sizes)
    expect(kite.positions).toHaveLength(total)
    expect(box(kite)[0]).toBeCloseTo(wide!, 2)
    expect(box(kite)[1]).toBeCloseTo(tall!, 2)
  })

  it('lays its first four rows from the point as a Delica 11/0 is beaded', () => {
    const at = (row: number, column: number) => fromPoint(kiteLayout(4, DELICA)).find((bead) => bead.row === row && bead.column === column)!
    const expected: [number, number, number, number][] = [
      [0, 0, -0.79, 0],
      [0, 1, 0.79, 0],
      [1, 0, -0.79, 1.17],
      [1, 1, 0.79, 1.17],
      [2, 0, -0.79, 2.35],
      [2, 1, 0.79, 2.35],
      [2, 2, -1.83, 0.65],
      [2, 3, 1.83, 0.65],
      [3, 0, -0.79, 3.52],
      [3, 1, 0.79, 3.52],
      [3, 2, -1.83, 1.82],
      [3, 3, 1.83, 1.82],
    ]
    for (const [row, column, x, y] of expected) {
      expect(at(row, column).x, `${row}:${column}`).toBeCloseTo(x, 2)
      expect(at(row, column).y, `${row}:${column}`).toBeCloseTo(y, 2)
    }
    expect(kiteLayout(4, DELICA).positions).toHaveLength(12)
  })

  it('sets its spine pair 0.786 either side of the spine, inner corners touching, stepping 1.174 down a row', () => {
    expect(Math.hypot(1, DELICA / 2)).toBeCloseTo(1.174, 3)
    const beads = fromPoint(kiteLayout(10, DELICA))
    for (let row = 0; row < 10; row += 1) {
      const [left, right] = [0, 1].map((column) => beads.find((bead) => bead.row === row && bead.column === column)!)
      expect(left!.x).toBeCloseTo(-0.786, 3)
      expect(right!.x).toBeCloseTo(0.786, 3)
      expect(right!.y).toBeCloseTo(row * Math.hypot(1, DELICA / 2), 9)
      expect(left!.y).toBe(right!.y)
      const inner = Math.min(...outlineOf(right!, DELICA).map(({ x }) => x))
      expect(inner).toBeCloseTo(0, 9)
    }
  })

  it('is plain flat peyote in each wing: two widths apart in a row, each bead touching the two it sits between, and nothing overlaps', () => {
    const kite = kiteLayout(12, DELICA)
    sharesNothing(kite)
    liesInside(kite)
    expect(crossingSeams(kite)).toEqual([])
    const bead = (row: number, place: number, side: number) => kite.positions.find((each) => each.row === row && each.column === 2 * place + side)
    for (const each of kite.positions.filter(({ row }) => row > 0)) {
      const [place, side] = [Math.floor(each.column / 2), each.column % 2]
      // Measured along its row and across it: a bead a width either way and half a depth on from the row before.
      const offset = (other: LayoutPosition) => [(other.x - each.x) * Math.cos(each.angle) + (other.y - each.y) * Math.sin(each.angle), -(other.x - each.x) * Math.sin(each.angle) + (other.y - each.y) * Math.cos(each.angle)]
      const before = [bead(each.row - 1, place, side), bead(each.row - 1, place - 1, side)].filter((other) => other !== undefined)
      expect(before.length).toBeGreaterThan(0)
      for (const other of before) {
        expect(Math.abs(offset(other)[0]!)).toBeCloseTo(1, 9)
        expect(Math.abs(offset(other)[1]!)).toBeCloseTo(DELICA / 2, 9)
        expect(layoutNeighbors(kite, each)).toContainEqual({ row: other.row, column: other.column })
      }
      const next = bead(each.row, place + 1, side)
      if (next) expect(Math.hypot(next.x - each.x, next.y - each.y)).toBeCloseTo(2, 9)
    }
  })

  it('draws every bead a width along its wing\'s rows and its Bead\'s depth across, the wings leaning 58.39 degrees', () => {
    for (const depth of [DELICA, 1]) {
      const kite = kiteLayout(9, depth)
      expect(kite.beadDepth).toBe(depth)
      const lean = Math.PI / 2 - Math.atan(depth / 2)
      expect(new Set(kite.positions.map(({ panel, angle }) => `${panel}:${angle.toFixed(6)}`))).toEqual(new Set([`0:${lean.toFixed(6)}`, `1:${(Math.PI - lean).toFixed(6)}`]))
      sharesNothing(kite)
    }
    expect((Math.PI / 2 - Math.atan(DELICA / 2)) * (180 / Math.PI)).toBeCloseTo(58.39, 2)
  })

  it('is two wings either side of a spine down its middle, each the other\'s mirror image', () => {
    const kite = kiteLayout(9, DELICA)
    expect(kite.panels).toHaveLength(2)
    expect(kite.seams).toHaveLength(1)
    expect(kite.symmetry).toEqual({ fold: 1, line: 0 })
    for (const { x, y, row, column, panel } of kite.positions) {
      expect(panel === 0 ? x < kite.centre.x : x > kite.centre.x).toBe(true)
      const twin = kite.positions.find((each) => each.row === row && each.column === column + (panel === 0 ? 1 : -1))!
      expect(twin.x - kite.centre.x).toBeCloseTo(kite.centre.x - x, 9)
      expect(twin.y).toBeCloseTo(y, 9)
    }
  })

  it('refuses a press on its spine between two rows\' pairs, and fills across it where the spine pair touch', () => {
    const kite = kiteLayout(15, DELICA)
    const [left, right] = [0, 1].map((column) => kite.positions.find((position) => position.row === 5 && position.column === column)!)
    expect(layoutPositionAt(kite, (left!.x + right!.x) / 2, left!.y + 0.6)).toBeUndefined()
    expect(layoutNeighbors(kite, { row: 3, column: 0 })).toContainEqual({ row: 3, column: 1 })
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

  describe('with its top woven in another Technique (ticket 0814)', () => {
    const woven = (top: FringeTop, topWidth: number, topRows: number) => fringeLayout({ topWidth, topRows, fringeStyle: 'straight', fringeLength: 3 }, top)
    /** Each column's beads in the top, from the left. */
    const columnHeights = (layout: FrameLayout) => Array.from({ length: Math.max(...top(layout).map(({ column }) => column)) + 1 }, (_unused, column) => top(layout).filter((bead) => bead.column === column).length)
    /** Where each strand starts, from the left. */
    const strandTops = (layout: FrameLayout) => layout.panels.flatMap((panel, index) => (panel.strand ? [Math.min(...layout.positions.filter((bead) => bead.panel === index).map(({ y }) => y))] : []))
    /** Whether every bead has a counterpart across the middle. */
    const mirrored = (layout: FrameLayout) => {
      const at = (x: number, y: number) => `${(x - layout.centre.x).toFixed(3)}:${y.toFixed(3)}`
      const places = new Set(layout.positions.map(({ x, y }) => at(x, y)))
      return layout.positions.every(({ x, y }) => places.has(at(2 * layout.centre.x - x, y)))
    }

    it('tapers a peyote top a bead a column outwards from its middle, the strands hanging from each column at two heights', () => {
      const peyote = woven({ lines: 'columns', drop: 1, twoPasses: true }, 7, 4)
      expect(columnHeights(peyote)).toEqual([1, 2, 3, 4, 3, 2, 1])
      const starts = strandTops(peyote)
      expect(Math.abs(starts[1]! - starts[0]!)).toBeCloseTo(0.5)
      expect(starts[2]).toBeCloseTo(starts[0]!)
      expect(mirrored(peyote)).toBe(true)
      // More Top rows give every column a body as tall under its point.
      expect(columnHeights(woven({ lines: 'columns', drop: 1, twoPasses: true }, 7, 6))).toEqual([3, 4, 5, 6, 5, 4, 3])
    })

    it('tapers a 2-drop peyote top a stitch of a bead a block of two columns', () => {
      const twoDrop = woven({ lines: 'columns', drop: 2, twoPasses: true }, 6, 2)
      expect(columnHeights(twoDrop)).toEqual([1, 1, 2, 2, 1, 1])
      expect(mirrored(twoDrop)).toBe(true)
    })

    it('steps a loom top in a bead each side a row, its strands hanging straight', () => {
      const loom = woven({ lines: 'rows', drop: 1, twoPasses: false }, 6, 3 + 2)
      expect(rowSizes({ ...loom, positions: top(loom).filter(({ row }) => row >= 0) })).toEqual([6, 4, 2])
      expect(top(loom).filter(({ row }) => row < 0)).toHaveLength(2 * 6)
      expect(new Set(strandTops(loom)).size).toBe(1)
      expect(mirrored(loom)).toBe(true)
      expect(mirrored(woven({ lines: 'rows', drop: 1, twoPasses: false }, 7, 4))).toBe(true)
    })

    it('tapers a 2-drop brick top a stitch, a bead, every two rows, its body in blocks of two', () => {
      const twoDrop = woven({ lines: 'shiftedRows', drop: 2, twoPasses: false }, 4, 6 + 4)
      expect(rowSizes({ ...twoDrop, positions: top(twoDrop).filter(({ row }) => row >= 0) })).toEqual([4, 4, 3, 3, 2, 2])
      const body = top(twoDrop).filter(({ row }) => row < 0)
      expect([0, 1, 2, 3].map((line) => body.filter(({ row }) => row === -1000 + line).length)).toEqual([4, 4, 3, 3])
      expect(mirrored(twoDrop)).toBe(true)
    })
  })

  describe('with more Top rows than its point needs (ticket 0814)', () => {
    /** The top's rows from the base up, by where they lie: each row's bead count and its first bead's x. */
    const rowsUp = (layout: FrameLayout) => {
      const lines = [...new Set(top(layout).map(({ y }) => y))].sort((a, b) => b - a)
      return lines.map((y) => {
        const beads = top(layout).filter((bead) => bead.y === y)
        return { beads: beads.length, x: Math.min(...beads.map((bead) => bead.x)) }
      })
    }

    it('lays a full-width body under the point, its brick rows alternating the Width and one fewer half a bead in', () => {
      const tall = earring('straight', 5, 4 + 4, 6)
      expect(rowsUp(tall).map(({ beads }) => beads)).toEqual([5, 4, 5, 4, 5, 4, 3, 2])
      const [base, second] = rowsUp(tall)
      expect(second!.x - base!.x).toBeCloseTo(0.5)
      // The strands still hang one under each bead of the base row.
      expect(strandLengths(tall)).toEqual([6, 6, 6, 6, 6])
    })

    it('stays symmetric about the middle of its base row', () => {
      const layout = earring('v', 6, 5 + 6, 9)
      const at = (x: number, y: number) => `${(x - layout.centre.x).toFixed(3)}:${y.toFixed(3)}`
      const places = new Set(layout.positions.map(({ x, y }) => at(x, y)))
      expect(layout.positions.filter(({ x, y }) => !places.has(at(2 * layout.centre.x - x, y)))).toEqual([])
    })

    it('keeps the point\'s beads in the point as the body grows, the body\'s own rows named apart from both', () => {
      const point = earring('straight', 6, 5)
      const tall = earring('straight', 6, 5 + 2)
      const names = (layout: FrameLayout) => new Set(top(layout).map(({ row, column }) => `${row}:${column}`))
      expect([...names(point)].every((key) => names(tall).has(key))).toBe(true)
      // The point lies two rows higher over the body, each of its beads as it was.
      const pointBase = (layout: FrameLayout) => layout.positions.find(({ row, column }) => row === 0 && column === 0)!
      const strandTop = (layout: FrameLayout) => layout.positions.find(({ row, column }) => row === 1000 && column === 0)!
      expect(strandTop(tall).y - pointBase(tall).y).toBeCloseTo(strandTop(point).y - pointBase(point).y + 2)
      // A taller body keeps the rows of the shorter one.
      expect([...names(tall)].every((key) => names(earring('straight', 6, 5 + 4)).has(key))).toBe(true)
    })
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
