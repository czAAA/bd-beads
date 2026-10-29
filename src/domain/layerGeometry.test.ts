import { describe, expect, it } from 'vitest'
import { CELL_SIZE_PX } from '../rendering/cellSize'
import { layerExtentPx, positionBoxPx, positionsBoxPx, type Region } from '../rendering/surfaceView'
import type { Rect } from './canvas'
import { customFrameSize, frameGeometry, frameShapeOf, frameLayoutOf, type FrameShapeId, type FrameSettings, type ShapedSheet, type QuarterTurns } from './frameShape'
import { layoutNeighbors, layoutPosition, layoutPositionAt } from './frameLayout'
import type { GridPosition } from './grid'
import { gridGeometry, layoutPlacement, type LayerGeometry } from './layerGeometry'
import { describeWeave, neighborsOf, TECHNIQUES, type BeadCell, type Weave } from './weave'
import type { Box } from './weaveGeometry'

// Ticket 0628: the Layer geometry answers as the Weave and the layouts do, for every Technique and every Frame
// shape. Drawing and the Surface view's hit test ask it since ticket 0630, so it is checked against the domain's own
// answers and the bead boxes the Weave gives in px.

/** A Real cell, unlike any Technique's own, so the Bead shape is part of every answer. */
const REAL: BeadCell = { aspect: 1.3, roundness: 0.35 }

/** Every Technique, with its settings at their defaults and moved off them, in each Bead shape. */
const WEAVES: Weave[] = TECHNIQUES.flatMap((technique) =>
  [{ technique }, { technique, techniqueSettings: { brickBlock: 2 } }].flatMap((weave) => [weave, { ...weave, cell: REAL }]),
)

const named = (weave: Weave) => `${weave.technique} ${Object.values(weave.techniqueSettings ?? {}).join('')} ${weave.cell ? 'real' : 'symmetric'}`

/** Each Frame shape at two small sizes: a shape left out fails the type check. */
const CUSTOM: Record<FrameShapeId, FrameSettings[]> = {
  triangle: [{ rounds: 2 }, { rounds: 4 }],
  warpedSquare: [{ rounds: 2 }, { rounds: 3 }],
  star: [{ partSize: 2 }, { partSize: 3 }],
  kaleidocycle: [{ partSize: 3 }, { partSize: 4 }],
  kite: [{ rows: 4 }, { rows: 7 }],
  fringeEarring: [
    { topWidth: 3, topRows: 2, fringeLength: 3, fringeStyle: 'straight' },
    { topWidth: 4, topRows: 2, fringeLength: 4, fringeStyle: 'v' },
  ],
}

const TURNS: (QuarterTurns | undefined)[] = [undefined, 1, 2, 3]

/** Every Frame shape, size and turn, in each Bead shape: its rectangle as Change Frame makes it. */
const CUSTOM_FRAMES: ShapedSheet[] = (Object.entries(CUSTOM) as [FrameShapeId, FrameSettings[]][]).flatMap(([shape, sizes]) =>
  sizes.flatMap((settings) =>
    TURNS.flatMap((quarterTurns) =>
      [undefined, REAL].map((cell) => ({
        shape,
        settings,
        ...(quarterTurns ? { quarterTurns } : {}),
        ...customFrameSize(shape, settings, quarterTurns),
        technique: frameShapeOf({ shape })!.techniques[0],
        ...(cell ? { cell } : {}),
      })),
    ),
  ),
)

const customNamed = (frame: ShapedSheet) => `${frame.shape} ${JSON.stringify(frame.settings)} turned ${frame.quarterTurns ?? 0} ${frame.cell ? 'real' : 'symmetric'}`

/** A Frame without a shape in a Weave, 7 rows by 6 columns. */
const plain = (weave: Weave): ShapedSheet => ({ ...weave, rows: 7, columns: 6 })

/** A Box in grid px, as the Surface view gives one. */
const inPx = (box: Box): Region => ({ x: box.x * CELL_SIZE_PX, y: box.y * CELL_SIZE_PX, width: box.width * CELL_SIZE_PX, height: box.height * CELL_SIZE_PX })

function expectSameBox(actual: Region, expected: Region) {
  for (const side of ['x', 'y', 'width', 'height'] as const) expect(actual[side]).toBeCloseTo(expected[side], 6)
}

/** Every position of a block, the rows and columns round it too. */
function around({ row, column, rows, columns }: Rect): GridPosition[] {
  const all: GridPosition[] = []
  for (let r = row - 2; r < row + rows + 2; r += 1) for (let c = column - 2; c < column + columns + 2; c += 1) all.push({ row: r, column: c })
  return all
}

const sorted = (positions: readonly GridPosition[]) => [...positions].sort((a, b) => a.row - b.row || a.column - b.column)

/** Points across a stretch of grid px, a step apart that never lands on a bead's edge. */
function pointsIn(width: number, height: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (let y = 0.35; y < height; y += 2.9) for (let x = 0.35; x < width; x += 2.9) points.push({ x, y })
  return points
}

/** Each bead's middle hits it, and a point that hits a bead lies in that bead's box: an upright bead's, on a grid. */
function expectMiddlesHit(geometry: LayerGeometry, positions: readonly GridPosition[], across = 8, down = 8) {
  for (const position of positions) {
    const { x, y, width, height } = geometry.place(position)!.box
    expect(geometry.positionAt({ x: x + width / 2, y: y + height / 2 })).toEqual(position)
  }
  for (const point of pointsIn(across * CELL_SIZE_PX, down * CELL_SIZE_PX)) {
    const at = { x: point.x / CELL_SIZE_PX, y: point.y / CELL_SIZE_PX }
    const hit = geometry.positionAt(at)
    if (!hit) continue
    const { x, y, width, height } = geometry.place(hit)!.box
    expect(at.x >= x && at.x < x + width && at.y >= y && at.y < y + height).toBe(true)
  }
}

/** Every position whose bead touches a box is among those `positionsIn` gives for it, and those are positions it has,
 * a few beads from the box at most. */
function expectPositionsIn(geometry: LayerGeometry, everywhere: readonly GridPosition[], box: Box) {
  const given = geometry.positionsIn(box)
  for (const position of given) {
    expect(geometry.hasPosition(position)).toBe(true)
    const { x, y, width, height } = geometry.place(position)!.box
    expect(x + width >= box.x - 4 && x <= box.x + box.width + 4 && y + height >= box.y - 4 && y <= box.y + box.height + 4).toBe(true)
  }
  const touching = everywhere.filter((position) => {
    const place = geometry.place(position)
    if (!place) return false
    const { x, y, width, height } = place.box
    return x < box.x + box.width && x + width > box.x && y < box.y + box.height && y + height > box.y
  })
  for (const position of touching) expect(given).toContainEqual(position)
}

describe('a Frame without a shape answers as its Weave does', () => {
  it.each(WEAVES.map((weave) => [named(weave), plain(weave)] as const))('%s', (_name, frame) => {
    const geometry = frameGeometry(frame)
    const bounds = { row: 0, column: 0, rows: frame.rows, columns: frame.columns }
    const everywhere = around(bounds)
    const inside = (position: GridPosition) => position.row >= 0 && position.row < frame.rows && position.column >= 0 && position.column < frame.columns

    for (const position of everywhere) expect(geometry.hasPosition(position)).toBe(inside(position))
    expect(geometry.positions()).toEqual(everywhere.filter(inside))
    for (const position of geometry.positions()) {
      expect(sorted(geometry.neighbors(position))).toEqual(sorted(neighborsOf(frame, bounds, position).filter(inside)))
      const place = geometry.place(position)!
      expect(place.angle).toBe(0)
      expectSameBox(inPx(place.box), positionBoxPx(frame, position.row, position.column))
    }
    const { width, height } = layerExtentPx(frame, frame.columns, frame.rows)
    expectSameBox(inPx(geometry.extent()!), { x: 0, y: 0, width, height })
    expectMiddlesHit(geometry, geometry.positions(), width / CELL_SIZE_PX, height / CELL_SIZE_PX)
    expectPositionsIn(geometry, everywhere, { x: 1.3, y: 0.6, width: 2.2, height: 3.1 })
    // A band of rows redrawn (ticket 0674): those rows of the box alone.
    const whole = { x: 0, y: 0, width, height }
    expect(geometry.positionsIn(whole, { first: 1, last: 2 })).toEqual(geometry.positionsIn(whole).filter(({ row }) => row >= 1 && row <= 2))
    expect(geometry.grid).toBe(true)
    expect(geometry.seams()).toEqual([])
  })
})

describe('the open Canvas answers as its Weave does', () => {
  it.each(WEAVES.map((weave) => [named(weave), weave] as const))('%s', (_name, weave) => {
    const geometry = gridGeometry(weave)
    const near = around({ row: -4, column: -4, rows: 9, columns: 9 })
    for (const position of near) {
      expect(geometry.hasPosition(position)).toBe(true)
      expect(sorted(geometry.neighbors(position))).toEqual(sorted(neighborsOf(weave, undefined, position)))
      expectSameBox(inPx(geometry.place(position)!.box), positionBoxPx(weave, position.row, position.column))
    }
    expectMiddlesHit(geometry, near)
    expectPositionsIn(geometry, near, { x: -1.7, y: -2.2, width: 3.4, height: 2.9 })
  })

  it('has no edge, so no positions to list and no extent', () => {
    expect(gridGeometry({ technique: TECHNIQUES[0] }).positions()).toEqual([])
    expect(gridGeometry({ technique: TECHNIQUES[0] }).extent()).toBeUndefined()
  })
})

describe('a rectangle of a Weave away from the first position', () => {
  it.each(WEAVES.map((weave) => [named(weave), weave] as const))('%s answers as its Weave does within that edge', (_name, weave) => {
    const bounds = { row: 4, column: -3, rows: 5, columns: 4 }
    const geometry = gridGeometry(weave, bounds)
    const has = (position: GridPosition) => position.row >= 4 && position.row < 9 && position.column >= -3 && position.column < 1
    for (const position of around(bounds)) {
      expect(geometry.hasPosition(position)).toBe(has(position))
      if (!has(position)) continue
      expect(sorted(geometry.neighbors(position))).toEqual(sorted(neighborsOf(weave, bounds, position).filter(has)))
      expectSameBox(inPx(geometry.place(position)!.box), positionBoxPx(weave, position.row, position.column))
    }
    expect(geometry.positions()).toEqual(around(bounds).filter(has))
    expectSameBox(inPx(geometry.extent()!), positionsBoxPx(weave, bounds.row, bounds.column, bounds.rows, bounds.columns))
    // Each bead's middle is on it; a bead just past the edge is not the Layer's.
    expectMiddlesHit(geometry, geometry.positions())
    expectPositionsIn(geometry, around(bounds), { x: -2.5, y: 5, width: 2, height: 30 })
    const past = around(bounds).find((position) => position.row >= 4 && position.row < 9 && position.column >= 1)!
    const outside = gridGeometry(weave).place(past)!.box
    expect(geometry.positionAt({ x: outside.x + outside.width / 2, y: outside.y + outside.height / 2 })).toBeUndefined()
  })
})

describe('a Custom frame answers as its layout does', () => {
  it.each(CUSTOM_FRAMES.map((frame) => [customNamed(frame), frame] as const))('%s', (_name, frame) => {
    const geometry = frameGeometry(frame)
    const layout = frameLayoutOf(frame)!
    // The layout laid in the Frame's rectangle: a bead a cell wide (or as the rectangle allows), as deep as the Bead
    // shape's cell where the rounds leave it room.
    const placement = layoutPlacement(layout, frame, frame)
    const deep = placement.scale * Math.min(describeWeave(frame).cellAspect, layout.beadDepth)

    expect(geometry.positions()).toEqual(layout.positions.map(({ row, column }) => ({ row, column })))
    for (const position of around({ row: 0, column: 0, rows: Math.max(...layout.positions.map(({ row }) => row)) + 1, columns: frame.columns * 6 })) {
      expect(geometry.hasPosition(position)).toBe(layoutPosition(layout, position) !== undefined)
    }
    for (const position of geometry.positions()) {
      expect(geometry.neighbors(position)).toEqual(layoutNeighbors(layout, position))
      const place = geometry.place(position)!
      const bead = layoutPosition(layout, position)!
      const centre = { x: placement.x + bead.x * placement.scale, y: placement.y + bead.y * placement.scale }
      expect(place.angle).toBe(bead.angle)
      expectSameBox(inPx(place.box), inPx({ x: centre.x - placement.scale / 2, y: centre.y - deep / 2, width: placement.scale, height: deep }))
    }
    expect(geometry.place({ row: -1, column: 0 })).toBeUndefined()
    const { width, height } = layerExtentPx(frame, frame.columns, frame.rows)
    expectSameBox(inPx(geometry.extent()!), { x: 0, y: 0, width, height })
    // A point on the rectangle hits the bead the layout has there, in the layout's own bead widths.
    for (const point of pointsIn(width, height)) {
      const at = { x: point.x / CELL_SIZE_PX, y: point.y / CELL_SIZE_PX }
      expect(geometry.positionAt(at)).toEqual(layoutPositionAt(layout, (at.x - placement.x) / placement.scale, (at.y - placement.y) / placement.scale))
    }
    // A Custom frame is small: a view of any part of it draws every bead.
    expect(geometry.positionsIn({ x: 0, y: 0, width: 0.5, height: 0.5 })).toEqual(geometry.positions())
    expect(geometry.grid).toBe(false)
    expect(geometry.seams()).toEqual(layout.seams.map((seam) => seam.map(({ x, y }) => ({ x: placement.x + x * placement.scale, y: placement.y + y * placement.scale }))))
  })
})

describe('a point between beads', () => {
  it('hits none in a round bead\'s corner', () => {
    const round = gridGeometry({ technique: 'loom', cell: REAL })
    const { x, y } = round.place({ row: 2, column: 3 })!.box
    expect(round.positionAt({ x: x + 0.02, y: y + 0.02 })).toBeUndefined()
  })
})

describe('a point off a Frame', () => {
  it('hits none of its beads, whatever lays them out', () => {
    for (const frame of [plain({ technique: TECHNIQUES[0] }), CUSTOM_FRAMES[0]!]) {
      const { width, height } = frameGeometry(frame).extent()!
      for (const point of [{ x: -0.1, y: 0.5 }, { x: 0.5, y: -0.1 }, { x: width + 0.1, y: 0.5 }, { x: 0.5, y: height + 0.1 }]) {
        expect(frameGeometry(frame).positionAt(point)).toBeUndefined()
      }
    }
  })
})
