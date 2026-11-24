import { footprintOf } from './footprint'
import { beadBounds, beadsOver, beadsWithout, sameFrame, type FrameSheet, type Rect } from './canvas'
import { refitSheet, type SheetBeads } from './folding'
import type { GridPosition, FrameRef } from './grid'
import { columnCycle, rowCycle, type Weave } from './weave'
import { withMargin } from './margin'
import { canvasDistance, frameWeave, laidOnCanvas } from './layerWeave'
import { shapeSide, turnedGrid } from './frameShape'
import { laidSize } from './frameOrientation'
import { beadsOfLayer, heldWeave, type Layered, startingRowProgressOf, frameById } from './layerRecord'
import { touchFrameSheet } from './frameSheet'
import type { Project } from './project'
import { clampPointer } from './rowProgress'
import { frameQuarterTurnOf } from './table'

// The geometry of the Frame (CONTEXT.md, ADR 0026): drawing, moving, resizing from its edges and fitting to what is
// drawn, on whole beads. Made from the Canvas it starts on a cycle of the Canvas's rows (brick stitch) or columns (peyote,
// ticket 0734) so lifted beads keep their stagger; once made, its edges go by whole cycles of its own (tickets 477, 492).

export type FrameEdge = 'top' | 'bottom' | 'left' | 'right'

/** The four edges, in the order Edit Frame's controls list them (ticket 417). */
export const FRAME_EDGES: readonly FrameEdge[] = ['top', 'bottom', 'left', 'right']

/** The row a Frame may start on: the row itself, or the nearest start of a cycle above it where rows alternate. */
export function snapRow(weave: Weave, row: number): number {
  const cycle = rowCycle(weave)
  return row - (((row % cycle) + cycle) % cycle)
}

/** The column a Frame may start on (ticket 0734): the column itself, or the nearest start of a cycle to its left where
 * columns alternate. */
export function snapColumn(weave: Weave, column: number): number {
  const cycle = columnCycle(weave)
  return column - (((column % cycle) + cycle) % cycle)
}

/** A rectangle with its top and left moved back to where a Frame may start (snapRow, snapColumn), its bottom and right
 * kept: Frame from Selection's, and Set Frame around the picture's (ticket 0883). */
export function snappedFrame(weave: Weave, frame: Rect): Rect {
  const top = snapRow(weave, frame.row)
  const left = snapColumn(weave, frame.column)
  return { row: top, column: left, rows: frame.row + frame.rows - top, columns: frame.column + frame.columns - left }
}

// The Frame with the given edges dragged to a bead: `edges` are the sides a handle moves (a corner moves two), `cell`
// the bead under the pointer, in the Frame's own geometry. An edge never passes the opposite one, so a Frame stays at
// least one bead each way. Worked out in the Frame's own rows and columns, whose first are always unshifted (ticket 492).
export function frameWithEdges(weave: Weave, frame: Rect, edges: readonly FrameEdge[], cell: GridPosition): Rect {
  let top = 0
  let bottom = frame.rows - 1
  let left = 0
  let right = frame.columns - 1
  const at = { row: cell.row - frame.row, column: cell.column - frame.column }

  if (edges.includes('top')) top = Math.min(snapRow(weave, at.row), bottom)
  if (edges.includes('bottom')) bottom = Math.max(at.row, top)
  if (edges.includes('left')) left = Math.min(snapColumn(weave, at.column), right)
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

/** The fewest beads a side of the Frame keeps when stepped or typed (ticket 473), and the most a typed side takes: the
 * range the Frame panel's size fields say when they bring a number into it (ticket 0978). */
export const FEWEST_SIDE = 4
export const MAX_TYPED_SIDE = 999

// The Frame with one edge moved a bead out (`step` 1) or in (`step` -1), the others staying put (Edit Frame's steppers,
// ticket 417). The top edge goes by a whole cycle of rows (brick stitch) and the left by one of columns (peyote, ticket
// 0734), as dragging does. A step that would leave less than four beads each way changes nothing (ticket 473).
export function frameWithEdgeStep(weave: Weave, frame: Rect, edge: FrameEdge, step: 1 | -1): Rect {
  const rowStep = rowCycle(weave) * step
  const columnStep = columnCycle(weave) * step
  switch (edge) {
    case 'left':
      return step < 0 && frame.columns + columnStep < FEWEST_SIDE ? frame : { ...frame, column: frame.column - columnStep, columns: frame.columns + columnStep }
    case 'right':
      return step < 0 && frame.columns + step < FEWEST_SIDE ? frame : { ...frame, columns: frame.columns + step }
    case 'top':
      return step < 0 && frame.rows + rowStep < FEWEST_SIDE ? frame : { ...frame, row: frame.row - rowStep, rows: frame.rows + rowStep }
    case 'bottom':
      return step < 0 && frame.rows + step < FEWEST_SIDE ? frame : { ...frame, rows: frame.rows + step }
  }
}

/** The Frame resized to `columns` × `rows`, each side changing evenly on both edges (ticket 473), the right or bottom
 * taking an odd change's extra bead. Where rows alternate the top edge moves by whole cycles, and where columns do the
 * left edge (ticket 0734). A side keeps between FEWEST_SIDE and MAX_TYPED_SIDE beads. */
export function frameResizedAround(weave: Weave, frame: Rect, columns: number, rows: number): Rect {
  const side = (n: number) => Math.min(MAX_TYPED_SIDE, Math.max(FEWEST_SIDE, Math.round(n)))
  const wide = side(columns)
  const tall = side(rows)
  const [across, down] = [columnCycle(weave), rowCycle(weave)]
  const left = across > 1 ? across * Math.trunc((wide - frame.columns) / (2 * across)) : Math.trunc((wide - frame.columns) / 2)
  const top = down > 1 ? down * Math.trunc((tall - frame.rows) / (2 * down)) : Math.trunc((tall - frame.rows) / 2)
  return { row: frame.row - top, column: frame.column - left, rows: tall, columns: wide }
}

/** The Frame that wraps every bead drawn (Fit to drawing), or undefined when there is none: the Frame's own beads and
 * the Canvas's that show. Canvas beads under the Frame or in its margin are not drawn, so they are not wrapped. */
export function fitToDrawing(project: Layered, ref: FrameRef): Rect | undefined {
  const frame = frameById(project, ref)
  const covered = footprintOf(project, ref)
  const canvas = beadsOfLayer(project, 'canvas')
  const shown = frame && covered ? beadsOver(beadsWithout(canvas, withMargin(covered)), laidOnCanvas(project, beadsOfLayer(project, ref)!, frame, ref)) : canvas
  const bounds = beadBounds(shown)
  if (!bounds) {
    return undefined
  }
  const canvasWeave = heldWeave(project, 'canvas')
  const [top, left] = [snapRow(canvasWeave, bounds.row), snapColumn(canvasWeave, bounds.column)]
  return { row: top, column: left, rows: bounds.row + bounds.rows - top, columns: bounds.column + bounds.columns - left }
}

/** Where a resized Frame's first row and column go, as Canvas positions. The rectangle is in the Frame's own rows and
 * columns, so an edge moved by some of them moves the Frame's corner by as far on the Canvas; a turned one's corner
 * goes where its edges lie (`turnedOrigin`). */
function resizedOrigin(project: Project, current: FrameSheet, rectangle: Rect, ref: FrameRef): GridPosition {
  if (turnedGrid(current)) return turnedOrigin(project, current, rectangle, ref)
  const moved = canvasDistance(project, heldWeave(project, ref)!, rectangle.row - current.row, rectangle.column - current.column, ref)
  return { row: current.row + moved.row, column: current.column + moved.column }
}

/** Where a turned Frame resized to its own `rectangle` starts on the Canvas (ticket 1016): along each side as seen, the
 * edge whose own edge did not move stays; where both did (a typed size), the change is shared as they grew. */
function turnedOrigin(project: Project, current: FrameSheet, rectangle: Rect, ref: FrameRef): GridPosition {
  const own = frameWeave(project, ref)
  const grew: Record<FrameEdge, number> = {
    top: current.row - rectangle.row,
    left: current.column - rectangle.column,
    bottom: rectangle.row + rectangle.rows - current.row - current.rows,
    right: rectangle.column + rectangle.columns - current.column - current.columns,
  }
  const [was, now] = [laidSize({ ...current, ...own }), laidSize({ ...current, ...own, rows: rectangle.rows, columns: rectangle.columns })]
  const share = (first: FrameEdge, last: FrameEdge) => {
    const [before, after] = [Math.abs(grew[shapeSide(first, current.quarterTurns)]), Math.abs(grew[shapeSide(last, current.quarterTurns)])]
    return before + after === 0 ? 0 : before / (before + after)
  }
  const moved = canvasDistance(project, own, Math.round((now.rows - was.rows) * share('top', 'bottom')), Math.round((now.columns - was.columns) * share('left', 'right')), ref)
  return { row: current.row - moved.row, column: current.column - moved.column }
}

/** The Project with its Frame set to a rectangle of the Canvas, or removed (ADR 0026, 0066): its beads keep their
 * place, those outside a smaller Frame fold and show again when it grows back, the Canvas is never touched (ticket
 * 1215), a Frame set anew is empty, Row progress stays inside it; an unchanged Frame is the same Project. */
export function withFrame(project: Project, rectangle: Rect | undefined, ref: FrameRef): Project {
  if (sameFrame(frameById(project, ref), rectangle)) {
    return project
  }
  const current = frameById(project, ref)
  // With the Frame gone the passes are gone too (ticket 426): Row progress is the Frame's (ADR 0079).
  if (!rectangle) {
    return touchFrameSheet(project, undefined, { frame: ref })
  }
  const { rows, columns } = rectangle
  const { row, column } = current ? resizedOrigin(project, current, rectangle, ref) : rectangle
  const holds = (at: GridPosition) => at.row >= 0 && at.row < rows && at.column >= 0 && at.column < columns
  // A resized Frame keeps what it holds and folds the rest (ticket 1215); one made anew is empty.
  const refit: SheetBeads = current ? refitSheet(current, { row: rectangle.row - current.row, column: rectangle.column - current.column }, holds) : { beads: {} }
  const frame: FrameSheet = {
    row,
    column,
    rows,
    columns,
    beads: refit.beads,
    ...(refit.folded ? { folded: refit.folded } : {}),
    // A Frame made anew is woven as the Canvas is (ticket 492); one resized keeps its own.
    ...heldWeave(project, current ? ref : 'canvas')!,
    ...(current?.name ? { name: current.name } : {}),
    ...(current?.shape ? { shape: current.shape } : {}),
    ...(current?.settings ? { settings: current.settings } : {}),
    ...(current?.quarterTurns ? { quarterTurns: current.quarterTurns } : {}),
  }
  // One made anew starts its progress afresh (spec 1182); one resized keeps its pointers inside it.
  return touchFrameSheet(project, { ...frame, rowProgress: current ? clampPointer(current.rowProgress, frame, frameQuarterTurnOf(project, ref)) : startingRowProgressOf(frame) }, { frame: ref })
}
