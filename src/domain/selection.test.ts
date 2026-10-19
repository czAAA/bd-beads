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
  mirroredPastedCells,
  pastedCells,
  selectionBetween,
  type CopiedBlock,
} from './selection'
import { withColors } from './canvas'
import { createProject, withFrameGrid, type Project, frameGrid } from './project'
import { BEAD_CATALOG } from './beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

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

describe('copyLayerSelection (ticket 437, ADR 0057)', () => {
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

    expect(mirroredPastedCells({ frame: undefined, technique: 'loom' }, block, { row: 3, column: 3 }, { rows: 0, columns: 0 })).toEqual([
      { row: 3, column: 3, color: RED },
      { row: 4, column: 2, color: BLUE },
    ])
  })
})

describe('mirroredPastedCells and pasteOnLayer (ticket 50: Paste projects through Mirror)', () => {
  const dot: CopiedBlock = { rows: 1, columns: 1, colors: [[RED]], anchor: { row: 0, column: 0 } }

  it('with both axis counts at 0, behaves exactly like a single unmirrored pastedCells stamp', () => {
    const target = painted(['....', '....', '....', '....'])
    const at = { row: 1, column: 1 }
    const axes = { rows: 0, columns: 0 }

    expect(mirroredPastedCells(target, dot, at, axes)).toEqual(pastedCells(dot, at))
  })

  it('aims the anchor bead, not the block corner, and mirrors the rest of the block around it (ticket 437)', () => {
    const target = painted(['......', '......', '......', '......'])
    const lean: CopiedBlock = { rows: 1, columns: 2, colors: [[null, RED]], anchor: { row: 0, column: 1 } }

    const result = pasteOnLayer(target, lean, { row: 2, column: 1 }, { rows: 0, columns: 1 })

    expect(picture(result)).toEqual(['......', '......', '.r..r.', '......'])
  })

  it('with a single center axis on, stamps both the aimed spot and its one mirrored counterpart', () => {
    const target = painted(['......', '......', '......', '......'])

    // 6-wide grid, mirrored across columns (axisCount 1): column 1 <-> column 4.
    const result = pasteOnLayer(target, dot, { row: 2, column: 1 }, { rows: 0, columns: 1 })

    expect(picture(result)).toEqual(['......', '......', '.r..r.', '......'])
  })

  it('with N axes and copy mode off, stamps every strip, each copy independently flipped', () => {
    const motif: CopiedBlock = {
      rows: 1,
      columns: 2,
      colors: [[RED, null]],
      anchor: { row: 0, column: 0 },
    }
    // 6-wide grid, 2 axes -> strips [0,1] [2,3] [4,5]. Anchored at column 0 (spanning 0,1): strip0 stamps as-is
    // (r at 0, hole at 1); strip1 mirrors flipped (hole lands at 2, r lands at 3); strip2 translates unflipped
    // (r at 4, hole at 5) -- see the mirror.test.ts placements test this mirrors.
    const target = painted(['bbbbbb'], { r: RED, b: BLUE })

    const result = pasteOnLayer(target, motif, { row: 0, column: 0 }, { rows: 0, columns: 2 })

    expect(picture(result, { r: RED, b: BLUE })).toEqual(['rbbrrb'])
  })

  it('with copy mode on, translates every copy without flipping', () => {
    const motif: CopiedBlock = { rows: 1, columns: 2, colors: [[RED, null]], anchor: { row: 0, column: 0 } }
    const target = painted(['bbbbbb'], { r: RED, b: BLUE })

    const result = pasteOnLayer(target, motif, { row: 0, column: 0 }, { rows: 0, columns: 2 }, true)

    expect(picture(result, { r: RED, b: BLUE })).toEqual(['rbrbrb'])
  })

  it('leaves each copy’s own holes as holes, independently of the others', () => {
    const motif: CopiedBlock = { rows: 1, columns: 2, colors: [[RED, null]], anchor: { row: 0, column: 0 } }
    const target = painted(['bbbbbb'], { r: RED, b: BLUE })

    const result = pasteOnLayer(target, motif, { row: 0, column: 0 }, { rows: 0, columns: 1 })

    // Column 0->r, column1 is a hole (stays b); mirrored at columns 4/5 (6-wide, single axis): column5->r,
    // column4 is a hole (stays b).
    expect(picture(result, { r: RED, b: BLUE })).toEqual(['rbbbbr'])
  })

  it('clips each copy independently when it reaches past the grid’s edge', () => {
    const motif: CopiedBlock = { rows: 1, columns: 2, colors: [[RED, RED]], anchor: { row: 0, column: 0 } }
    // 6-wide grid, single axis (strips [0,1,2] [3,4,5]). Anchored at column 5 -- the block's own placement already
    // runs one cell past the grid's right edge; its mirror image runs one cell past the *left* edge instead.
    const target = painted(['......'])

    const result = pasteOnLayer(target, motif, { row: 0, column: 5 }, { rows: 0, columns: 1 })

    expect(picture(result)).toEqual(['r....r'])
  })

  it('honours copy mode in the preview the same way it does in the stamp', () => {
    const motif: CopiedBlock = { rows: 1, columns: 2, colors: [[RED, null]], anchor: { row: 0, column: 0 } }
    const target = painted(['bbbbbb'], { r: RED, b: BLUE })
    const at = { row: 0, column: 0 }
    const axes = { rows: 0, columns: 2 }

    const preview = mirroredPastedCells(target, motif, at, axes, true)
    const stamped = pasteOnLayer(target, motif, at, axes, true)

    for (const cell of preview) {
      expect(frameGrid(stamped)[cell.row]![cell.column]!.color).toBe(cell.color)
    }
  })

  it('returns the same Project, untouched, when every copy’s stamp would change nothing', () => {
    // 6-wide grid, 2 axes: a dot at column 0 lands on columns [0, 3, 4] (see mirror.test.ts's mirrorCounterparts
    // table for this exact dimension/axis-count) -- all three already red here.
    const target = painted(['r..rr.'])

    const result = pasteOnLayer(target, dot, { row: 0, column: 0 }, { rows: 0, columns: 2 })

    expect(result).toBe(target)
  })
})

describe('Piece and Select all selections (ticket 414)', () => {
  const picture = painted(['rr....', '.r..b.', '......', 'b...b.'])

  it('a tap selects the bounding rectangle of the tapped bead’s Piece, and nothing on an empty position', () => {
    expect(pieceSelectionAt(picture.frame!.beads, { technique: 'loom' }, { row: 1, column: 1 })).toEqual({ top: 0, left: 0, rows: 2, columns: 2 })
    expect(pieceSelectionAt(picture.frame!.beads, { technique: 'loom' }, { row: 2, column: 2 })).toBeUndefined()
  })

  it('a Piece’s rectangle includes the beads of other Pieces inside it', () => {
    const ring = painted(['rrrrr', 'r...r', 'r.b.r', 'r...r', 'rrrrr'])
    expect(pieceSelectionAt(ring.frame!.beads, { technique: 'loom' }, { row: 0, column: 0 })).toEqual({ top: 0, left: 0, rows: 5, columns: 5 })
    expect(pieceSelectionAt(ring.frame!.beads, { technique: 'loom' }, { row: 2, column: 2 })).toEqual({ top: 2, left: 2, rows: 1, columns: 1 })
  })

  it('Select all is the rectangle round every placed bead, and nothing on an empty canvas', () => {
    expect(allBeadsSelection(picture.frame!.beads)).toEqual({ top: 0, left: 0, rows: 4, columns: 5 })
    expect(allBeadsSelection(project(3, 3).frame!.beads)).toBeUndefined()
    // ticket 428: with a Frame, Select all is the Frame's inside, whatever the beads
    expect(selectAllSelection(picture.frame!.beads, { row: 2, column: 3, rows: 10, columns: 12 })).toEqual({ top: 2, left: 3, rows: 10, columns: 12, layer: 'frame' })
    expect(selectAllSelection(picture.frame!.beads, undefined)).toMatchObject({ top: 0, left: 0, rows: 4, columns: 5 })
  })
})

describe('Selections on a layer (ADR 0066)', () => {
  // A 3 x 3 Frame at (2, 2) holding red in its middle, over a Canvas holding blue beads, one under the Frame.
  const layered = (): Project => ({
    ...project(3, 3),
    beads: withColors({}, [{ row: 20, column: 20, color: BLUE }, { row: 3, column: 3, color: BLUE }]),
    frame: { technique: 'loom' as const, row: 2, column: 2, rows: 3, columns: 3, beads: withColors({}, [{ row: 1, column: 1, color: RED }]) },
  })

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
    const filled = paintLayerSelection(layered(), { top: 3, left: 3, rows: 5, columns: 5 }, RED, { columns: 0, rows: 0 })
    expect(filled.frame!.beads[2]).toEqual({ 1: RED, 2: RED })
    expect(filled.beads).toEqual(layered().beads)
  })

  it('pastes on the layer the pointer is at, and clips to the Frame there', () => {
    const block: CopiedBlock = { rows: 1, columns: 3, colors: [[RED, RED, RED]], anchor: { row: 0, column: 0 } }
    const inFrame = pasteOnLayer(layered(), block, { row: 3, column: 3 }, { columns: 0, rows: 0 })
    expect(inFrame.beads).toEqual(layered().beads)
    expect(inFrame.frame!.beads[1]).toEqual({ 1: RED, 2: RED })
    const onCanvas = pasteOnLayer(layered(), block, { row: 30, column: 9 }, { columns: 0, rows: 0 })
    expect(onCanvas.beads[30]).toEqual({ 9: RED, 10: RED, 11: RED })
    expect(onCanvas.frame).toEqual(layered().frame)
  })

  it('shows the paste preview where the paste would land, in Canvas positions and clipped to the Frame', () => {
    const block: CopiedBlock = { rows: 1, columns: 3, colors: [[RED, RED, RED]], anchor: { row: 0, column: 0 } }
    expect(pastedCellsOnLayer(layered(), block, { row: 3, column: 3 }, { columns: 0, rows: 0 })).toEqual([
      { row: 3, column: 3, color: RED },
      { row: 3, column: 4, color: RED },
    ])
  })

  it('taps a Piece of the layer the tap is on', () => {
    expect(pieceSelectionOnLayer(layered(), { row: 3, column: 3 })).toEqual({ top: 3, left: 3, rows: 1, columns: 1, layer: 'frame' })
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
  const beads = { 1: { 1: RED }, 3: { 2: BLUE } }

  it('is true for the Select all rectangle and anything round it', () => {
    expect(selectionHoldsAllBeads(beads, { top: 1, left: 1, rows: 3, columns: 2 })).toBe(true)
    expect(selectionHoldsAllBeads(beads, { top: 0, left: 0, rows: 9, columns: 9 })).toBe(true)
  })

  it('is false when a bead is left outside, and on an empty canvas', () => {
    expect(selectionHoldsAllBeads(beads, { top: 1, left: 1, rows: 2, columns: 2 })).toBe(false)
    expect(selectionHoldsAllBeads({}, { top: 0, left: 0, rows: 9, columns: 9 })).toBe(false)
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
    expect(pieceSelectionAt(beads, { technique: 'loom' }, { row: 12, column: 10 }, frame)).toEqual({ top: 12, left: 10, rows: 1, columns: 2 })
    expect(pieceSelectionAt(beads, { technique: 'loom' }, { row: 12, column: 9 }, frame)).toBeUndefined()
  })
})

describe('hasGuides', () => {
  it('is true from five beads in total, whatever the shape', () => {
    expect([[1, 1], [2, 2], [1, 4]].map(([rows, columns]) => hasGuides({ rows, columns }))).toEqual([false, false, false])
    expect([[1, 5], [5, 1], [2, 3]].map(([rows, columns]) => hasGuides({ rows, columns }))).toEqual([true, true, true])
  })
})
