import { beadBounds, beadsOver, beadsWithout, shiftedBeads, type Frame } from './canvas'
import type { GridPosition } from './grid'
import { describeWeave, rowCycle, type Weave } from './weave'
import { withMargin } from './margin'
import type { Project } from './project'

// The geometry of the Frame (CONTEXT.md, ADR 0026): drawing, moving, resizing from its edges and fitting to what is
// drawn, on whole beads. Where rows alternate a Frame starts on a multiple of the shift's cycle (a pair of rows, or 2N
// on brick stitch, ticket 477), so its first row sits where a woven piece's first row does.

export type FrameEdge = 'top' | 'bottom' | 'left' | 'right'

/** The four edges, in the order Edit Frame's controls list them (ticket 417). */
export const FRAME_EDGES: readonly FrameEdge[] = ['top', 'bottom', 'left', 'right']

/** The row a Frame may start on: the row itself, or the nearest start of a cycle above it where rows alternate. */
export function snapRow(weave: Weave, row: number): number {
  const cycle = rowCycle(weave)
  return row - (((row % cycle) + cycle) % cycle)
}

/** The Frame covering the beads from one corner to the other, whichever way the drag went, snapped to a legal top
 * row. */
export function frameFromCells(weave: Weave, a: GridPosition, b: GridPosition): Frame {
  const description = describeWeave(weave)
  const top = snapRow(weave, Math.min(a.row, b.row))
  const bottom = description.snapBottom(top, Math.max(a.row, b.row))
  const left = Math.min(a.column, b.column)
  const right = Math.max(a.column, b.column, left + description.smallest.columns - 1)
  return { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

// The Frame with the given edges dragged to a bead: `edges` are the sides a handle moves (a corner moves two), `cell`
// the bead under the pointer. An edge never passes the opposite one, so a Frame stays at least one bead each way.
export function frameWithEdges(weave: Weave, frame: Frame, edges: readonly FrameEdge[], cell: GridPosition): Frame {
  let top = frame.row
  let bottom = frame.row + frame.rows - 1
  let left = frame.column
  let right = frame.column + frame.columns - 1

  const { smallest, snapBottom } = describeWeave(weave)
  if (edges.includes('top')) top = Math.min(snapRow(weave, cell.row), snapBottom(top, bottom) - smallest.rows + 1)
  if (edges.includes('bottom')) bottom = snapBottom(top, Math.max(cell.row, top + smallest.rows - 1))
  if (edges.includes('left')) left = Math.min(cell.column, right - smallest.columns + 1)
  if (edges.includes('right')) right = Math.max(cell.column, left + smallest.columns - 1)

  return { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** The Frame moved by whole beads; where rows alternate whole cycles of rows, so its first row keeps its place in the
 * stagger. */
export function movedFrame(weave: Weave, frame: Frame, rows: number, columns: number): Frame {
  const cycle = rowCycle(weave)
  const rowStep = cycle > 1 ? Math.sign(rows) * Math.round(Math.abs(rows) / cycle) * cycle : rows
  return { ...frame, row: frame.row + rowStep, column: frame.column + columns }
}

/** The Frame with its size changed from the top-left corner, which stays where it is; never smaller than one bead
 * each way. */
export function frameWithSize(frame: Frame, columns: number, rows: number, weave: Weave = { technique: 'loom' }): Frame {
  const { smallest, snapBottom } = describeWeave(weave)
  const tall = snapBottom(frame.row, frame.row + Math.max(smallest.rows, Math.round(rows)) - 1) - frame.row + 1
  return { ...frame, columns: Math.max(smallest.columns, Math.round(columns)), rows: tall }
}

const MIN_STEPPED_SIDE = 4
const MAX_TYPED_SIDE = 999

// The Frame with one edge moved a bead out (`step` 1) or in (`step` -1), the others staying put (Edit Frame's steppers,
// ticket 417). Where rows alternate (peyote, brick stitch) the top edge goes by a whole cycle of rows so the first row
// keeps its place, as dragging the top handle does. A step that would leave less than four beads each way changes nothing (ticket 473).
export function frameWithEdgeStep(weave: Weave, frame: Frame, edge: FrameEdge, step: 1 | -1): Frame {
  const rowStep = rowCycle(weave) * step
  switch (edge) {
    case 'left':
      return step < 0 && frame.columns + step < MIN_STEPPED_SIDE ? frame : { ...frame, column: frame.column - step, columns: frame.columns + step }
    case 'right':
      return step < 0 && frame.columns + step < MIN_STEPPED_SIDE ? frame : { ...frame, columns: frame.columns + step }
    case 'top':
      return step < 0 && frame.rows + rowStep < MIN_STEPPED_SIDE ? frame : { ...frame, row: frame.row - rowStep, rows: frame.rows + rowStep }
    case 'bottom': {
      const down = describeWeave(weave).rowsPerUnit * step
      return step < 0 && frame.rows + down < MIN_STEPPED_SIDE ? frame : { ...frame, rows: frame.rows + down }
    }
  }
}

/** The Frame resized to `columns` × `rows` (Units where the Technique counts them), each side growing or shrinking evenly on both of its edges (ticket 473): an
 * odd change gives the extra bead to the right or bottom. Where rows alternate the top edge moves by whole cycles of
 * rows, so the first row keeps its place in the stagger. A side is kept between four and MAX_TYPED_SIDE beads. */
export function frameResizedAround(weave: Weave, frame: Frame, columns: number, rows: number): Frame {
  const description = describeWeave(weave)
  const typed = description.positionsOf({ columns, rows })
  const side = (n: number) => Math.min(MAX_TYPED_SIDE, Math.max(MIN_STEPPED_SIDE, Math.round(n)))
  const wide = side(typed.columns)
  const tall = description.snapBottom(0, side(typed.rows) - 1) + 1
  const left = Math.trunc((wide - frame.columns) / 2)
  const cycle = rowCycle(weave)
  const top = cycle > 1 ? cycle * Math.trunc((tall - frame.rows) / (2 * cycle)) : Math.trunc((tall - frame.rows) / 2)
  return { row: frame.row - top, column: frame.column - left, rows: tall, columns: wide }
}

/** The Frame that wraps every bead drawn (Fit to drawing), or undefined when there is none: the Frame's own beads and
 * the Canvas's that show. Canvas beads under the Frame or in its margin are not drawn, so they are not wrapped. */
export function fitToDrawing(project: Pick<Project, 'technique' | 'brickBlock' | 'beads' | 'frame'>): Frame | undefined {
  const frame = project.frame
  const shown = frame ? beadsOver(beadsWithout(project.beads, withMargin(frame)), shiftedBeads(frame.beads, frame.row, frame.column)) : project.beads
  const bounds = beadBounds(shown)
  if (!bounds) {
    return undefined
  }
  const top = snapRow(project, bounds.row)
  const bottom = describeWeave(project).snapBottom(top, bounds.row + bounds.rows - 1)
  const { columns: smallest } = describeWeave(project).smallest
  return { row: top, column: bounds.column, rows: bottom - top + 1, columns: Math.max(smallest, bounds.columns) }
}

export function sameFrame(a: Frame | undefined, b: Frame | undefined): boolean {
  return a === b || (!!a && !!b && a.row === b.row && a.column === b.column && a.rows === b.rows && a.columns === b.columns)
}
