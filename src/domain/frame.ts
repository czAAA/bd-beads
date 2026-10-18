import { beadBounds, forEachBead, type BeadMap, type Frame } from './canvas'
import { isOffsetTechnique, type GridPosition, type Technique } from './grid'
import { inMargin } from './margin'

// The geometry of the Frame (CONTEXT.md, ADR 0026): drawing, moving, resizing from its edges and fitting to what is
// drawn, on whole beads. On peyote and brick stitch a Frame starts on an even row, so its first row sits where a woven
// piece's first row does (rows alternate).

export type FrameEdge = 'top' | 'bottom' | 'left' | 'right'

/** The four edges, in the order Edit Frame's controls list them (ticket 417). */
export const FRAME_EDGES: readonly FrameEdge[] = ['top', 'bottom', 'left', 'right']

/** The row a Frame may start on: the row itself, or the even row above it where rows alternate. */
export function snapRow(technique: Technique, row: number): number {
  return isOffsetTechnique(technique) && Math.abs(row % 2) === 1 ? row - 1 : row
}

/** The Frame covering the beads from one corner to the other, whichever way the drag went, snapped to a legal top
 * row. */
export function frameFromCells(technique: Technique, a: GridPosition, b: GridPosition): Frame {
  const top = snapRow(technique, Math.min(a.row, b.row))
  const bottom = Math.max(a.row, b.row)
  const left = Math.min(a.column, b.column)
  const right = Math.max(a.column, b.column)
  return { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

// The Frame with the given edges dragged to a bead: `edges` are the sides a handle moves (a corner moves two), `cell`
// the bead under the pointer. An edge never passes the opposite one, so a Frame stays at least one bead each way.
export function frameWithEdges(technique: Technique, frame: Frame, edges: readonly FrameEdge[], cell: GridPosition): Frame {
  let top = frame.row
  let bottom = frame.row + frame.rows - 1
  let left = frame.column
  let right = frame.column + frame.columns - 1

  if (edges.includes('top')) top = Math.min(snapRow(technique, cell.row), bottom)
  if (edges.includes('bottom')) bottom = Math.max(cell.row, top)
  if (edges.includes('left')) left = Math.min(cell.column, right)
  if (edges.includes('right')) right = Math.max(cell.column, left)

  return { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** The Frame moved by whole beads; on peyote and brick stitch whole pairs of rows, so its first row keeps its place
 * in the stagger. */
export function movedFrame(technique: Technique, frame: Frame, rows: number, columns: number): Frame {
  const rowStep = isOffsetTechnique(technique) ? Math.sign(rows) * Math.round(Math.abs(rows) / 2) * 2 : rows
  return { ...frame, row: frame.row + rowStep, column: frame.column + columns }
}

/** The Frame with its size changed from the top-left corner, which stays where it is; never smaller than one bead
 * each way. */
export function frameWithSize(frame: Frame, columns: number, rows: number): Frame {
  return { ...frame, columns: Math.max(1, Math.round(columns)), rows: Math.max(1, Math.round(rows)) }
}

const MIN_STEPPED_SIDE = 4
const MAX_TYPED_SIDE = 999

// The Frame with one edge moved a bead out (`step` 1) or in (`step` -1), the others staying put (Edit Frame's steppers,
// ticket 417). Where rows alternate (peyote, brick stitch) the top edge goes by a pair of rows so the first row stays
// even, as dragging the top handle does. A step that would leave less than four beads each way changes nothing (ticket 473).
export function frameWithEdgeStep(technique: Technique, frame: Frame, edge: FrameEdge, step: 1 | -1): Frame {
  const rowStep = (isOffsetTechnique(technique) ? 2 : 1) * step
  switch (edge) {
    case 'left':
      return step < 0 && frame.columns + step < MIN_STEPPED_SIDE ? frame : { ...frame, column: frame.column - step, columns: frame.columns + step }
    case 'right':
      return step < 0 && frame.columns + step < MIN_STEPPED_SIDE ? frame : { ...frame, columns: frame.columns + step }
    case 'top':
      return step < 0 && frame.rows + rowStep < MIN_STEPPED_SIDE ? frame : { ...frame, row: frame.row - rowStep, rows: frame.rows + rowStep }
    case 'bottom':
      return step < 0 && frame.rows + step < MIN_STEPPED_SIDE ? frame : { ...frame, rows: frame.rows + step }
  }
}

/** The width and height typed as "20x120" (x, ×, * or the Cyrillic х between them), or none when it isn't one. */
export function parseFrameSize(text: string): { columns: number; rows: number } | undefined {
  const match = /^\s*(\d{1,4})\s*[x×*хХ]\s*(\d{1,4})\s*$/i.exec(text)
  return match ? { columns: Number(match[1]), rows: Number(match[2]) } : undefined
}

/** The Frame resized to `columns` × `rows`, each side growing or shrinking evenly on both of its edges (ticket 473): an
 * odd change gives the extra bead to the right or bottom. Where rows alternate the top edge moves by whole pairs of
 * rows, so the first row keeps its place in the stagger. A side is kept between four and MAX_TYPED_SIDE beads. */
export function frameResizedAround(technique: Technique, frame: Frame, columns: number, rows: number): Frame {
  const side = (n: number) => Math.min(MAX_TYPED_SIDE, Math.max(MIN_STEPPED_SIDE, Math.round(n)))
  const wide = side(columns)
  const tall = side(rows)
  const left = Math.trunc((wide - frame.columns) / 2)
  const top = isOffsetTechnique(technique) ? 2 * Math.trunc((tall - frame.rows) / 4) : Math.trunc((tall - frame.rows) / 2)
  return { row: frame.row - top, column: frame.column - left, rows: tall, columns: wide }
}

/** The Frame that wraps every bead drawn (Fit to drawing), or undefined for an empty canvas. Beads the `current`
 * Frame's margin covers are not drawn, so they are not wrapped. */
export function fitToDrawing(technique: Technique, beads: BeadMap, current?: Frame): Frame | undefined {
  const bounds = beadBounds(current ? withoutMargin(beads, current) : beads)
  if (!bounds) {
    return undefined
  }
  const top = snapRow(technique, bounds.row)
  return { row: top, column: bounds.column, rows: bounds.row + bounds.rows - top, columns: bounds.columns }
}

function withoutMargin(beads: BeadMap, frame: Frame): BeadMap {
  const shown: BeadMap = {}
  forEachBead(beads, (row, column, color) => {
    if (!inMargin(frame, { row, column })) {
      shown[row] ??= {}
      shown[row][column] = color
    }
  })
  return shown
}

export function sameFrame(a: Frame | undefined, b: Frame | undefined): boolean {
  return a === b || (!!a && !!b && a.row === b.row && a.column === b.column && a.rows === b.rows && a.columns === b.columns)
}
