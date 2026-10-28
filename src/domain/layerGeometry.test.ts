import { describe, expect, it } from 'vitest'
import { centredBead, layoutBeadPx, placedLayout } from '../rendering/customFrameView'
import { CELL_SIZE_PX } from '../rendering/cellSize'
import { OPEN_SPACE } from '../rendering/space'
import { gridBox, layerExtentPx, positionBoxPx, surfaceView, type Region } from '../rendering/surfaceView'
import type { Rect } from './canvas'
import { customFrameSize, frameHasPosition, frameKindOf, frameLayoutOf, type CustomFrameKindId, type FrameSettings, type KindedSheet, type QuarterTurns } from './frameKind'
import { layoutNeighbors } from './frameLayout'
import type { GridPosition } from './grid'
import { frameGeometry, gridGeometry, type LayerGeometry } from './layerGeometry'
import { describeWeave, neighborsOf, TECHNIQUES, type BeadCell, type Weave } from './weave'
import type { Box } from './weaveGeometry'

// Ticket 0628 (expand): the Layer geometry answers as today's code does, for every Technique and every Custom frame
// kind. Today's code lives in the domain and in the Surface view (hit test, bead boxes in px); once tickets 0629 and
// 0630 move their callers onto the Layer geometry, the comparisons with the old code go with it.

/** A Real cell, unlike any Technique's own, so the Bead shape is part of every answer. */
const REAL: BeadCell = { aspect: 1.3, roundness: 0.35 }

/** Every Technique, with its settings at their defaults and moved off them, in each Bead shape. */
const WEAVES: Weave[] = TECHNIQUES.flatMap((technique) =>
  [{ technique }, { technique, techniqueSettings: { brickBlock: 2, netSize: 5 } }].flatMap((weave) => [weave, { ...weave, cell: REAL }]),
)

const named = (weave: Weave) => `${weave.technique} ${Object.values(weave.techniqueSettings ?? {}).join('')} ${weave.cell ? 'real' : 'symmetric'}`

/** Each Custom frame kind at two small sizes: a kind left out fails the type check. */
const CUSTOM: Record<CustomFrameKindId, FrameSettings[]> = {
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

/** Every Custom frame kind, size and turn, in each Bead shape: its rectangle as Change Frame makes it. */
const CUSTOM_FRAMES: KindedSheet[] = (Object.entries(CUSTOM) as [CustomFrameKindId, FrameSettings[]][]).flatMap(([kind, sizes]) =>
  sizes.flatMap((settings) =>
    TURNS.flatMap((quarterTurns) =>
      [undefined, REAL].map((cell) => ({
        kind,
        settings,
        ...(quarterTurns ? { quarterTurns } : {}),
        ...customFrameSize(kind, settings, quarterTurns),
        technique: frameKindOf({ kind }).custom!.technique,
        ...(cell ? { cell } : {}),
      })),
    ),
  ),
)

const customNamed = (frame: KindedSheet) => `${frame.kind} ${JSON.stringify(frame.settings)} turned ${frame.quarterTurns ?? 0} ${frame.cell ? 'real' : 'symmetric'}`

/** A Rectangular Frame of a Weave, 7 rows by 6 columns: a whole number of every Technique's Units and row cycles. */
const rectangular = (weave: Weave): KindedSheet => ({ ...weave, rows: 7, columns: 6 })

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

/** What today's Surface view hits on a Frame at the Canvas's first position, at zoom 1 and no turn, on the Frame. */
function viewOfFrame(frame: KindedSheet) {
  const view = surfaceView({ space: OPEN_SPACE, ...frame, frame: { ...frame, row: 0, column: 0 }, rotation: 0, zoom: 1 })
  return (point: { x: number; y: number }): GridPosition | undefined => {
    const hit = view.pointToHit(point)
    return hit && hit.layer === 'frame' ? { row: hit.row, column: hit.column } : undefined
  }
}

const atPoint = (geometry: LayerGeometry, point: { x: number; y: number }) => geometry.positionAt({ x: point.x / CELL_SIZE_PX, y: point.y / CELL_SIZE_PX })

describe('a Rectangular Frame answers as its Weave does today', () => {
  it.each(WEAVES.map((weave) => [named(weave), rectangular(weave)] as const))('%s', (_name, frame) => {
    const geometry = frameGeometry(frame)
    const bounds = { row: 0, column: 0, rows: frame.rows, columns: frame.columns }
    const everywhere = around(bounds)
    const inside = (position: GridPosition) => position.row >= 0 && position.row < frame.rows && position.column >= 0 && position.column < frame.columns

    for (const position of everywhere) expect(geometry.hasPosition(position)).toBe(inside(position) && frameHasPosition(frame, position))
    expect(geometry.positions()).toEqual(everywhere.filter((position) => inside(position) && frameHasPosition(frame, position)))
    for (const position of geometry.positions()) {
      expect(sorted(geometry.neighbors(position))).toEqual(sorted(neighborsOf(frame, bounds, position).filter((next) => frameHasPosition(frame, next))))
      const place = geometry.place(position)!
      expect(place.angle).toBe(0)
      expectSameBox(inPx(place.box), positionBoxPx(frame, position.row, position.column))
    }
    expectSameBox(inPx(geometry.extent()!), gridBox(frame, bounds))
    const { width, height } = layerExtentPx(frame, frame.columns, frame.rows)
    const hitToday = viewOfFrame(frame)
    for (const point of pointsIn(width, height)) expect(atPoint(geometry, point)).toEqual(hitToday(point))
  })
})

describe('the open Canvas answers as its Weave does today', () => {
  it.each(WEAVES.map((weave) => [named(weave), weave] as const))('%s', (_name, weave) => {
    const geometry = gridGeometry(weave)
    const description = describeWeave(weave)
    for (const position of around({ row: -4, column: -4, rows: 9, columns: 9 })) {
      expect(geometry.hasPosition(position)).toBe(description.hasPosition(position))
      if (!description.hasPosition(position)) continue
      expect(sorted(geometry.neighbors(position))).toEqual(sorted(neighborsOf(weave, undefined, position).filter((next) => description.hasPosition(next))))
      expectSameBox(inPx(geometry.place(position)!.box), positionBoxPx(weave, position.row, position.column))
    }
    const view = surfaceView({ space: OPEN_SPACE, ...weave, rotation: 0, zoom: 1 })
    for (const point of pointsIn(8 * CELL_SIZE_PX, 8 * CELL_SIZE_PX)) {
      const hit = view.pointToHit(point)
      expect(atPoint(geometry, point)).toEqual(hit && { row: hit.row, column: hit.column })
    }
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
    const description = describeWeave(weave)
    const inside = (position: GridPosition) => position.row >= 4 && position.row < 9 && position.column >= -3 && position.column < 1
    const has = (position: GridPosition) => inside(position) && description.hasPosition(position, bounds)
    for (const position of around(bounds)) {
      expect(geometry.hasPosition(position)).toBe(has(position))
      if (!has(position)) continue
      expect(sorted(geometry.neighbors(position))).toEqual(sorted(neighborsOf(weave, bounds, position).filter(has)))
      expectSameBox(inPx(geometry.place(position)!.box), positionBoxPx(weave, position.row, position.column))
    }
    expect(geometry.positions()).toEqual(around(bounds).filter(has))
    expectSameBox(inPx(geometry.extent()!), gridBox(weave, bounds))
    // Each bead's middle is on it; a bead just past the edge is not the Layer's.
    for (const position of geometry.positions()) {
      const { x, y, width, height } = geometry.place(position)!.box
      expect(geometry.positionAt({ x: x + width / 2, y: y + height / 2 })).toEqual(position)
    }
    const past = around(bounds).find((position) => position.row >= 4 && position.row < 9 && position.column >= 1 && description.hasPosition(position))!
    const outside = gridGeometry(weave).place(past)!.box
    expect(geometry.positionAt({ x: outside.x + outside.width / 2, y: outside.y + outside.height / 2 })).toBeUndefined()
  })
})

describe('a Custom frame answers as its layout does today', () => {
  it.each(CUSTOM_FRAMES.map((frame) => [customNamed(frame), frame] as const))('%s', (_name, frame) => {
    const geometry = frameGeometry(frame)
    const layout = frameLayoutOf(frame)!
    const placed = placedLayout(frame, frame)!

    expect(geometry.positions()).toEqual(layout.positions.map(({ row, column }) => ({ row, column })))
    for (const position of around({ row: 0, column: 0, rows: Math.max(...layout.positions.map(({ row }) => row)) + 1, columns: frame.columns * 6 })) {
      expect(geometry.hasPosition(position)).toBe(frameHasPosition(frame, position))
    }
    for (const position of geometry.positions()) {
      expect(geometry.neighbors(position)).toEqual(layoutNeighbors(layout, position))
      const place = geometry.place(position)!
      const bead = layoutBeadPx(placed, position)!
      const drawn = centredBead(placed)
      expect(place.angle).toBe(bead.angle)
      expectSameBox(inPx(place.box), { x: bead.x + drawn.x, y: bead.y + drawn.y, width: drawn.width, height: drawn.height })
    }
    expect(geometry.place({ row: -1, column: 0 })).toBeUndefined()
    const { width, height } = layerExtentPx(frame, frame.columns, frame.rows)
    expectSameBox(inPx(geometry.extent()!), { x: 0, y: 0, width, height })
    const hitToday = viewOfFrame(frame)
    for (const point of pointsIn(width, height)) expect(atPoint(geometry, point)).toEqual(hitToday(point))
  })
})

describe('a point off a Frame', () => {
  it('hits none of its beads, whatever lays them out', () => {
    for (const frame of [rectangular({ technique: TECHNIQUES[0] }), CUSTOM_FRAMES[0]!]) {
      const { width, height } = frameGeometry(frame).extent()!
      for (const point of [{ x: -0.1, y: 0.5 }, { x: 0.5, y: -0.1 }, { x: width + 0.1, y: 0.5 }, { x: 0.5, y: height + 0.1 }]) {
        expect(frameGeometry(frame).positionAt(point)).toBeUndefined()
      }
    }
  })
})
