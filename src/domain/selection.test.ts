// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  allBeadsSelection,
  selectAllSelection,
  copyLayerSelection,
  hasGuides,
  paintLayerSelection,
  pastedCellsOnLayer,
  pieceSelectionOnLayer,
  selectionLayer,
  movedSelection,
  pieceSelectionAt,
  selectionHoldsAllBeads,
  selectionWithEdges,
  pasteOnLayer,
  stampedCells,
  pastedCells,
  selectionBetween,
  selectionHasHandles,
  selectionInFinishedRows,
  type CopiedBlock,
} from './selection'
import { type BeadMap, withColors } from './canvas'
import { createProject } from './createProject'
import { withFrame } from './frame'
import type { Project } from './project'
import { BEAD_CATALOG } from './beads'
import { frameGrid, withFrameGrid } from '../testUtils/frameGrid'
import { beadsOfLayer, frameOf } from './layerRecord'
import { sheetOf, withFields } from '../testUtils/flatFields'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

const RED = '#e63746'
const BLUE = '#2f6fed'

/** A loom Project of the given grid size, so a test can state "4x3" instead of a physical size that rounds to it. */
function project(columns: number, rows: number): Project {
  return createProject({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: columns * cubeBead.widthMm, height: rows * cubeBead.heightMm, unit: 'mm' },
  })
}

/** Paints a Project from a picture of it: one string per row, one character per column, '.' for an empty cell. */
function painted(rows: string[], colors: Record<string, string> = { r: RED, b: BLUE }): Project {
  const base = project(rows[0]!.length, rows.length)
  return withFrameGrid(
    base,
    rows.map((row) => [...row].map((char) => ({ color: colors[char] ?? null }))),
  )
}

/** The inverse of `painted`, so an expectation can be written as the picture it should produce. */
function picture(target: Project, colors: Record<string, string> = { r: RED, b: BLUE }): string[] {
  const chars = Object.entries(colors)
  return frameGrid(target).map((row) =>
    row.map((cell) => chars.find(([, hex]) => hex === cell.color)?.[0] ?? '.').join(''),
  )
}

describe('selectionBetween', () => {
  it('spans the rectangle between the two corners of a drag', () => {
    expect(selectionBetween({ row: 1, column: 2 }, { row: 3, column: 5 })).toEqual({
      top: 1,
      left: 2,
      rows: 3,
      columns: 4,
    })
  })

  it('spans the same rectangle whichever corner the drag started from', () => {
    const downRight = selectionBetween({ row: 1, column: 2 }, { row: 3, column: 5 })

    expect(selectionBetween({ row: 3, column: 5 }, { row: 1, column: 2 })).toEqual(downRight)
    expect(selectionBetween({ row: 3, column: 2 }, { row: 1, column: 5 })).toEqual(downRight)
  })

  it('covers a single cell when the drag never left the cell it started on', () => {
    expect(selectionBetween({ row: 4, column: 4 }, { row: 4, column: 4 })).toEqual({
      top: 4,
      left: 4,
      rows: 1,
      columns: 1,
    })
  })

  it('does not clamp a corner anywhere: the Canvas has no edge, and rows and columns may be negative', () => {
    expect(selectionBetween({ row: -5, column: -2 }, { row: 3, column: 1 })).toEqual({
      top: -5,
      left: -2,
      rows: 9,
      columns: 4,
    })
  })
})

describe('copyLayerSelection (ticket 437, ADR 0016)', () => {
  it('copies the drawn beads at the block’s own top-left origin', () => {
    const source = painted(['....', '.rb.', '.br.', '....'])

    expect(copyLayerSelection(source, { top: 1, left: 1, rows: 2, columns: 2 })).toEqual({
      rows: 2,
      columns: 2,
      colors: [
        [RED, BLUE],
        [BLUE, RED],
      ],
      anchor: { row: 0, column: 0 },
    })
  })

  it('trims to the drawn beads’ bounding box and keeps empty cells inside it as holes', () => {
    const source = painted(['.....', '..r..', '.....', '.b...', '.....'])

    expect(copyLayerSelection(source, { top: 0, left: 0, rows: 5, columns: 5 })).toEqual({
      rows: 3,
      columns: 2,
      colors: [
        [null, RED],
        [null, null],
        [BLUE, null],
      ],
      anchor: { row: 0, column: 1 },
    })
  })

  it('anchors on the leftmost bead of the top row, however the rest lie', () => {
    const source = painted(['.rr', 'b..'])

    expect(copyLayerSelection(source, { top: 0, left: 0, rows: 2, columns: 3 })?.anchor).toEqual({ row: 0, column: 1 })
  })

  it('copies nothing from a Selection with no drawn bead', () => {
    expect(copyLayerSelection(painted(['..', '..']), { top: 0, left: 0, rows: 2, columns: 2 })).toBeUndefined()
  })

  it('does not alias the Project’s own grid, so later edits cannot change what was copied', () => {
    const source = painted(['rr', 'rr'])
    const block = copyLayerSelection(source, { top: 0, left: 0, rows: 2, columns: 2 })

    frameGrid(source)[0]![0]!.color = BLUE

    expect(block!.colors[0]![0]).toBe(RED)
  })
})

describe('pastedCells', () => {
  const block: CopiedBlock = {
    rows: 2,
    columns: 2,
    colors: [
      [RED, null],
      [null, BLUE],
    ],
    anchor: { row: 0, column: 0 },
  }

  it('anchors the block’s top-left corner at the given position', () => {
    expect(pastedCells(block, { row: 2, column: 3 })).toEqual([
      { row: 2, column: 3, color: RED },
      { row: 3, column: 4, color: BLUE },
    ])
  })

  it('leaves out the block’s empty cells, which paste as holes rather than as erasures', () => {
    const cells = pastedCells(block, { row: 0, column: 0 })

    expect(cells).not.toContainEqual(expect.objectContaining({ row: 0, column: 1 }))
    expect(cells).not.toContainEqual(expect.objectContaining({ row: 1, column: 0 }))
  })

  it('keeps the whole block wherever it lands: the Canvas has no edge to clip at, negative positions included', () => {
    expect(pastedCells(block, { row: -1, column: -1 })).toEqual([
      { row: -1, column: -1, color: RED },
      { row: 0, column: 0, color: BLUE },
    ])
  })
})

describe('a stamp lands the anchor bead on the aimed cell (ticket 437)', () => {
  it('shifts the block back by the anchor, so no empty corner offsets it', () => {
    const block: CopiedBlock = { rows: 2, columns: 2, colors: [[null, RED], [BLUE, null]], anchor: { row: 0, column: 1 } }

    expect(stampedCells(block, { row: 3, column: 3 })).toEqual([
      { row: 3, column: 3, color: RED },
      { row: 4, column: 2, color: BLUE },
    ])
  })
})

describe('stampedCells and pasteOnLayer', () => {
  const dot: CopiedBlock = { rows: 1, columns: 1, colors: [[RED]], anchor: { row: 0, column: 0 } }

  it('stamps the block once, as a plain pastedCells would', () => {
    const at = { row: 1, column: 1 }

    expect(stampedCells(dot, at)).toEqual(pastedCells(dot, at))
  })

  it('aims the anchor bead, not the block corner (ticket 437)', () => {
    const target = painted(['......', '......', '......', '......'])
    const lean: CopiedBlock = { rows: 1, columns: 2, colors: [[null, RED]], anchor: { row: 0, column: 1 } }

    const result = pasteOnLayer(target, lean, { row: 2, column: 1 })

    expect(picture(result)).toEqual(['......', '......', '.r....', '......'])
  })

  it('leaves the block’s own holes as holes', () => {
    const motif: CopiedBlock = { rows: 1, columns: 2, colors: [[RED, null]], anchor: { row: 0, column: 0 } }
    const target = painted(['bbbbbb'], { r: RED, b: BLUE })

    const result = pasteOnLayer(target, motif, { row: 0, column: 0 })

    expect(picture(result, { r: RED, b: BLUE })).toEqual(['rbbbbb'])
  })

  it('clips what runs past the grid’s edge', () => {
    const motif: CopiedBlock = { rows: 1, columns: 2, colors: [[RED, RED]], anchor: { row: 0, column: 0 } }
    const target = painted(['......'])

    const result = pasteOnLayer(target, motif, { row: 0, column: 5 })

    expect(picture(result)).toEqual(['.....r'])
  })

  it('returns the same Project, untouched, when the stamp would change nothing', () => {
    const target = painted(['r.....'])

    expect(pasteOnLayer(target, dot, { row: 0, column: 0 })).toBe(target)
  })
})

describe('Piece and Select all selections (ticket 414)', () => {
  const picture = painted(['rr....', '.r..b.', '......', 'b...b.'])

  it('a tap selects the tapped bead’s Piece, a non-rectangular shape, and nothing on an empty position', () => {
    expect(pieceSelectionAt(frameOf(picture)!.beads, { technique: 'loom' }, { row: 1, column: 1 })).toEqual({
      top: 0,
      left: 0,
      rows: 2,
      columns: 2,
      cells: expect.arrayContaining([{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 1 }]),
    })
    expect(pieceSelectionAt(frameOf(picture)!.beads, { technique: 'loom' }, { row: 2, column: 2 })).toBeUndefined()
  })

  it('a Piece’s shape leaves out the beads of other Pieces inside its rectangle and the holes (ticket 547)', () => {
    const ring = painted(['rrrrr', 'r...r', 'r.b.r', 'r...r', 'rrrrr'])
    const outer = pieceSelectionAt(frameOf(ring)!.beads, { technique: 'loom' }, { row: 0, column: 0 })
    expect(outer).toMatchObject({ top: 0, left: 0, rows: 5, columns: 5 })
    expect(outer?.cells).toHaveLength(16)
    expect(outer?.cells).not.toContainEqual({ row: 2, column: 2 })
    expect(outer?.cells).not.toContainEqual({ row: 1, column: 1 })
    expect(pieceSelectionAt(frameOf(ring)!.beads, { technique: 'loom' }, { row: 2, column: 2 })).toEqual({
      top: 2,
      left: 2,
      rows: 1,
      columns: 1,
      cells: [{ row: 2, column: 2 }],
    })
  })

  it('Select all is the rectangle round every placed bead, and nothing on an empty canvas', () => {
    expect(allBeadsSelection(frameOf(picture)!.beads)).toEqual({ top: 0, left: 0, rows: 4, columns: 5 })
    expect(allBeadsSelection(frameOf(project(3, 3))!.beads)).toBeUndefined()
    // ticket 428: with a Frame, Select all is the Frame's inside, whatever the beads
    expect(selectAllSelection(frameOf(picture)!.beads, { row: 2, column: 3, rows: 10, columns: 12 })).toEqual({ top: 2, left: 3, rows: 10, columns: 12, layer: 'frame' })
    expect(selectAllSelection(frameOf(picture)!.beads, undefined)).toMatchObject({ top: 0, left: 0, rows: 4, columns: 5 })
  })
})

describe('Selections on a layer (ADR 0066)', () => {
  // A 3 x 3 Frame at (2, 2) holding red in its middle, over a Canvas holding blue beads, one under the Frame.
  const layered = (): Project => (withFields(project(3, 3), {
beads: withColors({}, [{ row: 20, column: 20, color: BLUE }, { row: 3, column: 3, color: BLUE }]),
    frame: { technique: 'loom' as const, row: 2, column: 2, rows: 3, columns: 3, beads: withColors({}, [{ row: 1, column: 1, color: RED }]) },
}))

  it('belongs to the layer its top-left bead is on', () => {
    expect(selectionLayer(layered(), { top: 2, left: 2, rows: 2, columns: 2 })).toBe('frame')
    expect(selectionLayer(layered(), { top: 0, left: 0, rows: 30, columns: 30 })).toBe('canvas')
  })

  it('copies the beads of the layer it is on: the Frame\'s own, not the Canvas bead hidden under them', () => {
    const block = copyLayerSelection(layered(), { top: 2, left: 2, rows: 3, columns: 3 })
    expect(block?.colors).toEqual([[RED]])
    expect(copyLayerSelection(layered(), { top: 20, left: 20, rows: 1, columns: 1 })?.colors).toEqual([[BLUE]])
  })

  it('fills the Frame\'s cells only, in the Frame, whatever the Selection reaches', () => {
    const filled = paintLayerSelection(layered(), { top: 3, left: 3, rows: 5, columns: 5 }, RED)
    expect(frameOf(filled)!.beads[2]).toEqual({ 1: RED, 2: RED })
    expect(beadsOfLayer(filled, 'canvas')).toEqual(beadsOfLayer(layered(), 'canvas'))
  })

  it('pastes on the layer the pointer is at, and clips to the Frame there', () => {
    const block: CopiedBlock = { rows: 1, columns: 3, colors: [[RED, RED, RED]], anchor: { row: 0, column: 0 } }
    const inFrame = pasteOnLayer(layered(), block, { row: 3, column: 3 })
    expect(beadsOfLayer(inFrame, 'canvas')).toEqual(beadsOfLayer(layered(), 'canvas'))
    expect(frameOf(inFrame)!.beads[1]).toEqual({ 1: RED, 2: RED })
    const onCanvas = pasteOnLayer(layered(), block, { row: 30, column: 9 })
    expect(beadsOfLayer(onCanvas, 'canvas')[30]).toEqual({ 9: RED, 10: RED, 11: RED })
    expect(sheetOf(onCanvas)).toEqual(sheetOf(layered()))
  })

  it('shows the paste preview where the paste would land, in Canvas positions and clipped to the Frame', () => {
    const block: CopiedBlock = { rows: 1, columns: 3, colors: [[RED, RED, RED]], anchor: { row: 0, column: 0 } }
    expect(pastedCellsOnLayer(layered(), block, { row: 3, column: 3 })).toEqual([
      { row: 3, column: 3, color: RED },
      { row: 3, column: 4, color: RED },
    ])
  })

  it('copies, for a Canvas Selection across a Frame that draws shorter than the rows it names, only what lies clear of what it draws and its margin (ticket 0659)', () => {
    const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
    // A 48-row peyote Frame covers 36 loom rows: rows 36 to 39 are its margin, row 40 is free Canvas.
    const placed = withFrame(base, { row: 0, column: 0, rows: 48, columns: 11 })
    const woven: Project = withFields(placed, { frame: { ...frameOf(placed)!, technique: 'peyote' }, beads: withColors({}, [{ row: 38, column: 3, color: RED }, { row: 40, column: 3, color: BLUE }]) })
    expect(copyLayerSelection(woven, { top: 0, left: 3, rows: 50, columns: 1, layer: 'canvas' })?.colors).toEqual([[BLUE]])
  })

  it('taps a Piece of the layer the tap is on', () => {
    expect(pieceSelectionOnLayer(layered(), { row: 3, column: 3 })).toEqual({ top: 3, left: 3, rows: 1, columns: 1, layer: 'frame', cells: [{ row: 3, column: 3 }] })
    expect(pieceSelectionOnLayer(layered(), { row: 20, column: 20 })).toMatchObject({ top: 20, left: 20, rows: 1, columns: 1 })
  })
})

describe('resizing and moving a Selection (ticket 414)', () => {
  const selection = { top: 2, left: 3, rows: 4, columns: 5 }

  it('a handle drags the sides it stands on, a corner two', () => {
    expect(selectionWithEdges(selection, ['left'], { row: 9, column: 1 })).toEqual({ top: 2, left: 1, rows: 4, columns: 7 })
    expect(selectionWithEdges(selection, ['bottom', 'right'], { row: 9, column: 10 })).toEqual({ top: 2, left: 3, rows: 8, columns: 8 })
  })

  it('a side never passes the one opposite it', () => {
    expect(selectionWithEdges(selection, ['top'], { row: 20, column: 0 })).toEqual({ top: 5, left: 3, rows: 1, columns: 5 })
    expect(selectionWithEdges(selection, ['right'], { row: 0, column: -4 })).toEqual({ top: 2, left: 3, rows: 4, columns: 1 })
  })

  it('moves by whole beads and keeps its size', () => {
    expect(movedSelection(selection, -1, 2)).toEqual({ top: 1, left: 5, rows: 4, columns: 5 })
  })
})

describe('selectionHoldsAllBeads (ticket 415)', () => {
  const open = (beads: BeadMap): Project => (withFields(project(4, 4), { frame: undefined, beads }))
  const framed = (beads: BeadMap, frameBeads: BeadMap): Project => {
    const placed = withFrame(project(4, 4), { row: 10, column: 10, rows: 3, columns: 3 })
    return withFields(placed, { beads, frame: { ...frameOf(placed)!, beads: frameBeads } })
  }

  it('is true for the Select all rectangle and anything round it', () => {
    const beads = { 1: { 1: RED }, 3: { 2: BLUE } }
    expect(selectionHoldsAllBeads(open(beads), { top: 1, left: 1, rows: 3, columns: 2 })).toBe(true)
    expect(selectionHoldsAllBeads(open(beads), { top: 0, left: 0, rows: 9, columns: 9 })).toBe(true)
  })

  it('is false when a bead is left outside, and on an empty canvas', () => {
    expect(selectionHoldsAllBeads(open({ 1: { 1: RED }, 3: { 2: BLUE } }), { top: 1, left: 1, rows: 2, columns: 2 })).toBe(false)
    expect(selectionHoldsAllBeads(open({}), { top: 0, left: 0, rows: 9, columns: 9 })).toBe(false)
  })

  it('is false when its rectangle goes round a bead on the other layer, which Clear selection leaves (ticket 0659)', () => {
    const frameSelection = { top: 0, left: 0, rows: 30, columns: 30, layer: 'frame' as const }
    expect(selectionHoldsAllBeads(framed({ 2: { 2: RED } }, { 0: { 0: BLUE } }), frameSelection)).toBe(false)
    expect(selectionHoldsAllBeads(framed({}, { 0: { 0: BLUE } }), frameSelection)).toBe(true)
    expect(selectionHoldsAllBeads(framed({ 2: { 2: RED } }, { 0: { 0: BLUE } }), { ...frameSelection, layer: 'canvas' })).toBe(false)
  })
})

describe('pieceSelectionAt with a Frame (ticket 433)', () => {
  const frame = { row: 10, column: 10, rows: 4, columns: 6 }
  const beads = withColors(
    {},
    [
      { row: 12, column: 9, color: '#e63746' },
      { row: 12, column: 10, color: '#e63746' },
      { row: 12, column: 11, color: '#e63746' },
      { row: 12, column: 8, color: '#e63746' },
    ],
  )

  it('takes the part on the tapped bead\'s side: the inside, or clear of the margin', () => {
    expect(pieceSelectionAt(beads, { technique: 'loom' }, { row: 12, column: 10 }, frame)).toEqual({
      top: 12,
      left: 10,
      rows: 1,
      columns: 2,
      cells: [{ row: 12, column: 10 }, { row: 12, column: 11 }],
    })
    expect(pieceSelectionAt(beads, { technique: 'loom' }, { row: 12, column: 9 }, frame)).toBeUndefined()
  })
})

describe('hasGuides', () => {
  it('is true from five beads in total, whatever the shape', () => {
    expect([[1, 1], [2, 2], [1, 4]].map(([rows, columns]) => hasGuides({ rows, columns }))).toEqual([false, false, false])
    expect([[1, 5], [5, 1], [2, 3]].map(([rows, columns]) => hasGuides({ rows, columns }))).toEqual([true, true, true])
  })
})

describe('a Piece-tool shape (ticket 547)', () => {
  // A red ring with a blue Piece in its hole: the ring is not a rectangle, and its rectangle holds another Piece.
  const target = painted(['rrrrr', 'r...r', 'r.b.r', 'r...r', 'rrrrr'])
  const L = pieceSelectionOnLayer(target, { row: 0, column: 0 })!

  it('is the Piece alone, without the other Piece or the holes inside its rectangle', () => {
    expect(L).toMatchObject({ top: 0, left: 0, rows: 5, columns: 5 })
    expect(L.cells).toHaveLength(16)
    expect(L.cells).not.toContainEqual({ row: 2, column: 2 })
    expect(L.cells).not.toContainEqual({ row: 1, column: 1 })
  })

  it('has no handles, where a rectangle of the same size has them', () => {
    expect(selectionHasHandles(L)).toBe(false)
    expect(selectionHasHandles({ top: 0, left: 0, rows: 5, columns: 5 })).toBe(true)
  })

  it('copies its own beads only, holes in the block where the rectangle held other beads', () => {
    expect(copyLayerSelection(target, L)?.colors).toEqual([
      [RED, RED, RED, RED, RED],
      [RED, null, null, null, RED],
      [RED, null, null, null, RED],
      [RED, null, null, null, RED],
      [RED, RED, RED, RED, RED],
    ])
  })

  it('clears and fills its own cells only, never the other Piece or the empty cells', () => {
    expect(picture(paintLayerSelection(target, L, null))).toEqual(['.....', '.....', '..b..', '.....', '.....'])
    expect(picture(paintLayerSelection(target, L, BLUE))).toEqual(['bbbbb', 'b...b', 'b.b.b', 'b...b', 'bbbbb'])
  })

})

describe('selectionInFinishedRows (ticket 0647, ADR 0052)', () => {
  /** A loom Frame of 6 x 6 at (10, 10) whose first two rows are done. */
  const woven: Project = withFields(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } }), {
frame: { technique: 'loom', row: 10, column: 10, rows: 6, columns: 6, beads: {} },
    rowProgress: { direction: 'rows', currentRow: 2, currentColumn: 0 },
})

  it('is true for a Frame Selection that holds a position of a finished pass', () => {
    expect(selectionInFinishedRows(woven, { top: 11, left: 12, rows: 2, columns: 2 })).toBe(true)
    // Select all with a Frame: the whole Frame.
    expect(selectionInFinishedRows(woven, { top: 10, left: 10, rows: 6, columns: 6 })).toBe(true)
  })

  it('is false for a Frame Selection clear of finished passes, and for any Selection on the Canvas', () => {
    expect(selectionInFinishedRows(woven, { top: 12, left: 10, rows: 4, columns: 6 })).toBe(false)
    expect(selectionInFinishedRows(woven, { top: 0, left: 0, rows: 4, columns: 4 })).toBe(false)
    // Begun on the Canvas beside the Frame's finished rows, it stays the Canvas's.
    expect(selectionInFinishedRows(woven, { top: 10, left: 2, rows: 2, columns: 12, layer: 'canvas' })).toBe(false)
  })

  it('reads a shaped Selection by its own cells, and the way the rows run', () => {
    const shape = { top: 11, left: 10, rows: 2, columns: 2, cells: [{ row: 12, column: 11 }] }
    expect(selectionInFinishedRows(woven, shape)).toBe(false)
    const fromTheLeft = withFields(woven, { rowProgress: { direction: 'columns' as const, currentRow: 0, currentColumn: 2 } })
    expect(selectionInFinishedRows(fromTheLeft, { top: 14, left: 11, rows: 1, columns: 1 })).toBe(true)
    expect(selectionInFinishedRows(fromTheLeft, { top: 10, left: 12, rows: 1, columns: 1 })).toBe(false)
  })
})
