// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadsFromColors, forEachBead, type BeadMap } from './canvas'
import { createProject } from './createProject'
import { beadsOfLayer } from './layerRecord'
import { moveLayerSelection, stepMove, wholeMove } from './moveSelection'
import { namedPieces, withPieceName } from './pieceNames'
import type { Project } from './project'
import { pieceSelectionOnLayer } from './selection'
import { type LayersChange, withLayers } from '../testUtils/layerFields'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
const RED = '#aa0000'
const BLUE = '#0000bb'

/** An L of three beads at (10, 10):  R B / R .  */
const PIECE = beadsFromColors(
  [
    [RED, BLUE],
    [RED, null],
  ],
  { row: 10, column: 10 },
)

function canvasWith(beads: BeadMap, extra: LayersChange = {}): Project {
  return withLayers(base, { beads, ...extra })
}

function positionsOf(beads: BeadMap | undefined): string[] {
  const found: string[] = []
  forEachBead(beads ?? {}, (row, column, color) => found.push(`${row},${column}:${color}`))
  return found.sort()
}

describe('moveLayerSelection (ticket 1013)', () => {
  it('moves a Piece\'s beads and its Selection by whole beads, as one shape', () => {
    const project = canvasWith(PIECE)
    const selection = pieceSelectionOnLayer(project, { row: 10, column: 10 })!

    const moved = moveLayerSelection(project, selection, 2, -3)!

    expect(positionsOf(beadsOfLayer(moved.project, 'canvas'))).toEqual([`12,7:${RED}`, `12,8:${BLUE}`, `13,7:${RED}`])
    expect(moved.selection).toMatchObject({ top: 12, left: 7, rows: 2, columns: 2 })
    expect(moved.selection.cells).toEqual(selection.cells!.map(({ row, column }) => ({ row: row + 2, column: column - 3 })))
  })

  it('moves onto the places its own beads leave', () => {
    const project = canvasWith(PIECE)
    const selection = pieceSelectionOnLayer(project, { row: 10, column: 10 })!

    const moved = moveLayerSelection(project, selection, 1, 0)!

    expect(positionsOf(beadsOfLayer(moved.project, 'canvas'))).toEqual([`11,10:${RED}`, `11,11:${BLUE}`, `12,10:${RED}`])
  })

  it('leaves the beads of other Pieces inside its rectangle where they are', () => {
    // A bead two columns from the L's foot, inside its bounding rectangle once the L is wider.
    const wide = beadsFromColors(
      [
        [RED, RED, RED],
        [RED, null, null],
        [RED, null, BLUE],
      ],
      { row: 10, column: 10 },
    )
    const project = canvasWith(wide)
    const selection = pieceSelectionOnLayer(project, { row: 10, column: 10 })!

    const moved = moveLayerSelection(project, selection, 0, 10)!

    expect(positionsOf(beadsOfLayer(moved.project, 'canvas'))).toContain(`12,12:${BLUE}`)
    expect(positionsOf(beadsOfLayer(moved.project, 'canvas'))).toHaveLength(6)
  })

  it('makes no move that would land a bead on another Piece\'s bead', () => {
    const project = canvasWith({ ...PIECE, 10: { ...PIECE[10], 14: BLUE } })
    const selection = pieceSelectionOnLayer(project, { row: 10, column: 10 })!

    expect(moveLayerSelection(project, selection, 0, 3)).toBeUndefined()
    expect(moveLayerSelection(project, selection, 0, 5)).toBeDefined()
  })

  it('makes no move at all by nothing', () => {
    const project = canvasWith(PIECE)

    expect(moveLayerSelection(project, pieceSelectionOnLayer(project, { row: 10, column: 10 })!, 0, 0)).toBeUndefined()
  })

  it('stops a Canvas Piece at the Frame\'s keep-out margin', () => {
    const project = canvasWith(PIECE, { frame: { technique: 'loom', row: 10, column: 30, rows: 5, columns: 5, beads: {} } })
    const selection = pieceSelectionOnLayer(project, { row: 10, column: 10 })!

    // The margin is four beads wide: column 25 is the last clear one, and the L's second column would pass it.
    expect(moveLayerSelection(project, selection, 0, 14)).toBeDefined()
    expect(moveLayerSelection(project, selection, 0, 15)).toBeUndefined()
  })

  it('moves a Frame Piece inside the Frame and stops it at the Frame\'s edge', () => {
    const inFrame = beadsFromColors([[RED, BLUE]], { row: 1, column: 1 })
    const project = canvasWith({}, { frame: { technique: 'loom', row: 20, column: 20, rows: 5, columns: 5, beads: inFrame } })
    const selection = pieceSelectionOnLayer(project, { row: 21, column: 21, layer: 'frame' })!

    const moved = moveLayerSelection(project, selection, 2, 1)!

    expect(positionsOf(beadsOfLayer(moved.project, 'frame'))).toEqual([`3,2:${RED}`, `3,3:${BLUE}`])
    expect(moved.selection).toMatchObject({ top: 23, left: 22, layer: 'frame' })
    expect(moveLayerSelection(project, selection, 0, 3)).toBeUndefined()
  })

  it('makes no move out of or into a row marked done', () => {
    const inFrame = beadsFromColors([[RED]], { row: 3, column: 1 })
    const project = canvasWith({}, { frame: { technique: 'loom', row: 20, column: 20, rows: 5, columns: 5, beads: inFrame }, rowProgress: { direction: 'rows', currentRow: 2, currentColumn: 0 } })
    const selection = pieceSelectionOnLayer(project, { row: 23, column: 21, layer: 'frame' })!

    expect(moveLayerSelection(project, selection, 1, 0)).toBeDefined()
    expect(moveLayerSelection(project, selection, -3, 0)).toBeUndefined()
  })

  it('carries a Piece\'s name with its beads', () => {
    const project = withPieceName(canvasWith(PIECE), { row: 10, column: 10 }, 'Fox')
    const selection = pieceSelectionOnLayer(project, { row: 10, column: 10 })!

    const moved = moveLayerSelection(project, selection, 6, 6)!

    expect(namedPieces(moved.project)).toMatchObject([{ name: 'Fox', row: 16, column: 16 }])
  })
})

describe('stepMove (ticket 1013)', () => {
  it('steps a bead where rows and columns stand straight, and a whole cycle across a stagger', () => {
    const loom = canvasWith(PIECE)
    const peyote = canvasWith(PIECE, { technique: 'peyote' })

    expect(stepMove(loom, pieceSelectionOnLayer(loom, { row: 10, column: 10 })!, 0, -1)).toEqual({ rows: 0, columns: -1 })
    expect(stepMove(peyote, pieceSelectionOnLayer(peyote, { row: 10, column: 10 })!, 1, -1)).toEqual({ rows: 1, columns: -2 })
  })
})

describe('wholeMove (ticket 1013)', () => {
  it('moves by any number of beads where rows and columns stand straight', () => {
    const project = canvasWith(PIECE)

    expect(wholeMove(project, pieceSelectionOnLayer(project, { row: 10, column: 10 })!, 3, -1)).toEqual({ rows: 3, columns: -1 })
  })

  it('moves by a pair of columns on peyote and a pair of rows on brick stitch, so the beads touch as they did', () => {
    const peyote = canvasWith(PIECE, { technique: 'peyote' })
    const brick = canvasWith(PIECE, { technique: 'brick' })

    expect(wholeMove(peyote, pieceSelectionOnLayer(peyote, { row: 10, column: 10 })!, 3, 3)).toEqual({ rows: 3, columns: 4 })
    expect(wholeMove(peyote, pieceSelectionOnLayer(peyote, { row: 10, column: 10 })!, 0, -0.4)).toEqual({ rows: 0, columns: 0 })
    expect(wholeMove(peyote, pieceSelectionOnLayer(peyote, { row: 10, column: 10 })!, 0, -1)).toEqual({ rows: 0, columns: -2 })
    expect(wholeMove(brick, pieceSelectionOnLayer(brick, { row: 10, column: 10 })!, 1, 5)).toEqual({ rows: 2, columns: 5 })
  })
})
