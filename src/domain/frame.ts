import { beadBounds, forEachBead, type BeadMap, type Frame } from './canvas'
import { isOffsetTechnique, type GridPosition, type Technique } from './grid'
import { inMargin } from './margin'

/**
 * The geometry of the Frame (CONTEXT.md, ADR 0026): drawing it, moving it, resizing it from its edges and fitting it to
 * what is drawn. All of it works on whole beads, and on peyote and brick stitch a Frame always starts on an even row, so
 * that its first row sits where a woven piece's first row does (the rows alternate, and a piece begins unshifted).
 */

export type FrameEdge = 'top' | 'bottom' | 'left' | 'right'

/** The four edges, in the order Edit Frame's controls list them (ticket 417). */
export const FRAME_EDGES: readonly FrameEdge[] = ['top', 'bottom', 'left', 'right']

/** The row a Frame may start on: the row itself, or the even row above it where rows alternate. */
export function snapRow(technique: Technique, row: number): number {
  return isOffsetTechnique(technique) && Math.abs(row % 2) === 1 ? row - 1 : row
}

/** The Frame covering the beads from one corner to the other, whichever way the drag went, snapped to a legal top row. */
export function frameFromCells(technique: Technique, a: GridPosition, b: GridPosition): Frame {
  const top = snapRow(technique, Math.min(a.row, b.row))
  const bottom = Math.max(a.row, b.row)
  const left = Math.min(a.column, b.column)
  const right = Math.max(a.column, b.column)
  return { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

/**
 * The Frame with the given edges dragged to a bead: `edges` are the sides a handle moves (a corner moves two), `cell` the
 * bead the pointer is over. An edge never passes the one opposite it, so a Frame stays at least one bead each way.
 */
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

/** The Frame moved by whole beads; on peyote and brick stitch whole pairs of rows, so its first row keeps its place in the stagger. */
export function movedFrame(technique: Technique, frame: Frame, rows: number, columns: number): Frame {
  const rowStep = isOffsetTechnique(technique) ? Math.sign(rows) * Math.round(Math.abs(rows) / 2) * 2 : rows
  return { ...frame, row: frame.row + rowStep, column: frame.column + columns }
}

/** The Frame with its size changed from the top-left corner, which stays where it is; never smaller than one bead each way. */
export function frameWithSize(frame: Frame, columns: number, rows: number): Frame {
  return { ...frame, columns: Math.max(1, Math.round(columns)), rows: Math.max(1, Math.round(rows)) }
}

/**
 * The Frame with one edge moved a bead out (`step` 1) or in (`step` -1), the other three staying put (Edit Frame's
 * margin steppers, ticket 417). Where rows alternate (peyote, brick stitch) the top edge goes by a pair of rows so the
 * first row stays on an even row, as dragging the top handle does. An edge never passes the one opposite it: a step that
 * would leave less than one bead each way changes nothing.
 */
export function frameWithEdgeStep(technique: Technique, frame: Frame, edge: FrameEdge, step: 1 | -1): Frame {
  const rowStep = (isOffsetTechnique(technique) ? 2 : 1) * step
  switch (edge) {
    case 'left':
      return frame.columns + step < 1 ? frame : { ...frame, column: frame.column - step, columns: frame.columns + step }
    case 'right':
      return frame.columns + step < 1 ? frame : { ...frame, columns: frame.columns + step }
    case 'top':
      return frame.rows + rowStep < 1 ? frame : { ...frame, row: frame.row - rowStep, rows: frame.rows + rowStep }
    case 'bottom':
      return frame.rows + step < 1 ? frame : { ...frame, rows: frame.rows + step }
  }
}

/** The Frame that wraps every bead drawn (Fit to drawing), or undefined for an empty canvas. Beads the `current` Frame's margin covers are not drawn, so they are not wrapped. */
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
