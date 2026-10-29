import { footprintOf } from './footprint'
import { beadBounds, beadsOver, beadsWithout, sameFrame, shiftedBeads, type BeadMap, type FrameSheet, type Rect } from './canvas'
import { refitSheet } from './folding'
import type { GridPosition } from './grid'
import { rowCycle, type Weave } from './weave'
import { withMargin } from './margin'
import { canvasDistance, canvasWeave } from './layerWeave'
import { beadsOfLayer, heldWeave } from './layerRecord'
import type { Project } from './project'
import { clampPointer, firstPasses } from './rowProgress'

// The geometry of the Frame (CONTEXT.md, ADR 0026): drawing, moving, resizing from its edges and fitting to what is
// drawn, on whole beads. Made from the Canvas it starts on a cycle of the Canvas's rows so lifted beads keep their stagger;
// once made, its edges go by whole cycles of its own rows (tickets 477, 492).

export type FrameEdge = 'top' | 'bottom' | 'left' | 'right'

/** The four edges, in the order Edit Frame's controls list them (ticket 417). */
export const FRAME_EDGES: readonly FrameEdge[] = ['top', 'bottom', 'left', 'right']

/** The row a Frame may start on: the row itself, or the nearest start of a cycle above it where rows alternate. */
export function snapRow(weave: Weave, row: number): number {
  const cycle = rowCycle(weave)
  return row - (((row % cycle) + cycle) % cycle)
}

// The Frame with the given edges dragged to a bead: `edges` are the sides a handle moves (a corner moves two), `cell`
// the bead under the pointer, in the Frame's own geometry. An edge never passes the opposite one, so a Frame stays at
// least one bead each way. Worked out in the Frame's own rows, whose row 0 is always an unshifted one (ticket 492).
export function frameWithEdges(weave: Weave, frame: Rect, edges: readonly FrameEdge[], cell: GridPosition): Rect {
  let top = 0
  let bottom = frame.rows - 1
  let left = 0
  let right = frame.columns - 1
  const at = { row: cell.row - frame.row, column: cell.column - frame.column }

  if (edges.includes('top')) top = Math.min(snapRow(weave, at.row), bottom)
  if (edges.includes('bottom')) bottom = Math.max(at.row, top)
  if (edges.includes('left')) left = Math.min(at.column, right)
  if (edges.includes('right')) right = Math.max(at.column, left)

  return { row: frame.row + top, column: frame.column + left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** The Frame moved by whole Canvas positions. */
export function movedFrame(frame: Rect, rows: number, columns: number): Rect {
  return { ...frame, row: frame.row + rows, column: frame.column + columns }
}

/** The Frame with its size changed from the top-left corner, which stays where it is; never smaller than one bead
 * each way. */
export function frameWithSize(frame: Rect, columns: number, rows: number): Rect {
  return { ...frame, columns: Math.max(1, Math.round(columns)), rows: Math.max(1, Math.round(rows)) }
}

/** The fewest beads a side of the Frame keeps when stepped or typed (ticket 473). */
const FEWEST_SIDE = 4
const MAX_TYPED_SIDE = 999

// The Frame with one edge moved a bead out (`step` 1) or in (`step` -1), the others staying put (Edit Frame's steppers,
// ticket 417). Where rows alternate (peyote, brick stitch) the top edge goes by a whole cycle of rows so the first row
// keeps its place, as dragging the top handle does. A step that would leave less than four beads each way changes nothing (ticket 473).
export function frameWithEdgeStep(weave: Weave, frame: Rect, edge: FrameEdge, step: 1 | -1): Rect {
  const rowStep = rowCycle(weave) * step
  switch (edge) {
    case 'left':
      return step < 0 && frame.columns + step < FEWEST_SIDE ? frame : { ...frame, column: frame.column - step, columns: frame.columns + step }
    case 'right':
      return step < 0 && frame.columns + step < FEWEST_SIDE ? frame : { ...frame, columns: frame.columns + step }
    case 'top':
      return step < 0 && frame.rows + rowStep < FEWEST_SIDE ? frame : { ...frame, row: frame.row - rowStep, rows: frame.rows + rowStep }
    case 'bottom':
      return step < 0 && frame.rows + step < FEWEST_SIDE ? frame : { ...frame, rows: frame.rows + step }
  }
}

/** The Frame resized to `columns` × `rows`, each side changing evenly on both edges (ticket 473), the right or bottom
 * taking an odd change's extra bead. Where rows alternate the top edge moves by whole cycles. A side keeps between
 * FEWEST_SIDE and MAX_TYPED_SIDE beads. */
export function frameResizedAround(weave: Weave, frame: Rect, columns: number, rows: number): Rect {
  const side = (n: number) => Math.min(MAX_TYPED_SIDE, Math.max(FEWEST_SIDE, Math.round(n)))
  const wide = side(columns)
  const tall = side(rows)
  const left = Math.trunc((wide - frame.columns) / 2)
  const cycle = rowCycle(weave)
  const top = cycle > 1 ? cycle * Math.trunc((tall - frame.rows) / (2 * cycle)) : Math.trunc((tall - frame.rows) / 2)
  return { row: frame.row - top, column: frame.column - left, rows: tall, columns: wide }
}

/** The Frame that wraps every bead drawn (Fit to drawing), or undefined when there is none: the Frame's own beads and
 * the Canvas's that show. Canvas beads under the Frame or in its margin are not drawn, so they are not wrapped. */
export function fitToDrawing(project: Pick<Project, 'technique' | 'techniqueSettings' | 'beads' | 'frame'>): Rect | undefined {
  const frame = project.frame
  const covered = footprintOf(project)
  const canvas = beadsOfLayer(project, 'canvas')
  const shown = frame && covered ? beadsOver(beadsWithout(canvas, withMargin(covered)), shiftedBeads(beadsOfLayer(project, 'frame')!, frame.row, frame.column)) : canvas
  const bounds = beadBounds(shown)
  if (!bounds) {
    return undefined
  }
  const top = snapRow(heldWeave(project, 'canvas'), bounds.row)
  return { row: top, column: bounds.column, rows: bounds.row + bounds.rows - top, columns: bounds.columns }
}

/** Where a resized Frame's first row and column go, as Canvas positions. The rectangle is in the Frame's own rows and
 * columns, so an edge moved by some of them moves the Frame's corner by as far on the Canvas. */
function resizedOrigin(project: Project, current: FrameSheet, rectangle: Rect): GridPosition {
  const moved = canvasDistance(project, heldWeave(project, 'frame')!, rectangle.row - current.row, rectangle.column - current.column)
  return { row: current.row + moved.row, column: current.column + moved.column }
}

/** The Project with its Frame set to a rectangle of the Canvas, or removed (ADR 0026, 0066): its beads keep their
 * place, those outside a smaller Frame are dropped or, woven unlike the Canvas, folded (ticket 0638), the Canvas is
 * never touched, a Frame set anew is empty, Row progress stays inside it; an unchanged Frame is the same Project. */
export function withFrame(project: Project, rectangle: Rect | undefined): Project {
  return withFrameGiving(project, rectangle).project
}

/** `withFrame`, and the beads the resized Frame trades with the Canvas, by Canvas position. Woven like the Canvas it
 * gives up those it no longer holds and takes in the Canvas beads `offered` where it shows none of its own (ticket
 * 0639); woven unlike it, it folds and takes nothing (ticket 0638). The resize lays and lifts them there. */
export function withFrameGiving(project: Project, rectangle: Rect | undefined, offered: BeadMap = {}): { project: Project; given: BeadMap; taken: BeadMap } {
  if (sameFrame(project.frame, rectangle)) {
    return { project, given: {}, taken: {} }
  }
  const { frame: current, ...rest } = project
  // With the Frame gone the passes are gone too (ticket 426).
  if (!rectangle) {
    return { project: { ...rest, rowProgress: firstPasses(project.rowProgress), updatedAt: Date.now() }, given: {}, taken: {} }
  }
  const { rows, columns } = rectangle
  const { row, column } = current ? resizedOrigin(project, current, rectangle) : rectangle
  const holds = (at: GridPosition) => at.row >= 0 && at.row < rows && at.column >= 0 && at.column < columns
  // A resized Frame keeps what it holds, folds or gives up the rest (ticket 0638) and takes what is offered (ticket
  // 0639); one made anew is empty.
  const refit = current
    ? refitSheet(current, canvasWeave(project), { row: rectangle.row - current.row, column: rectangle.column - current.column }, holds, shiftedBeads(offered, -row, -column))
    : { beads: {}, given: {}, taken: {} }
  const frame: FrameSheet = {
    row,
    column,
    rows,
    columns,
    beads: refit.beads,
    ...(refit.folded ? { folded: refit.folded } : {}),
    // A Frame made anew is woven as the Canvas is (ticket 492); one resized keeps its own.
    ...heldWeave(project, current ? 'frame' : 'canvas')!,
    ...(current?.name ? { name: current.name } : {}),
    ...(current?.kind ? { kind: current.kind } : {}),
    ...(current?.settings ? { settings: current.settings } : {}),
    ...(current?.quarterTurns ? { quarterTurns: current.quarterTurns } : {}),
  }
  return {
    project: { ...rest, frame, rowProgress: clampPointer(project.rowProgress, frame), updatedAt: Date.now() },
    given: shiftedBeads(refit.given, row, column),
    taken: shiftedBeads(refit.taken, row, column),
  }
}
