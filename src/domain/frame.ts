import { beadBounds, sameFrame, type FrameSheet, type Rect } from './canvas'
import { refitSheet, type SheetBeads } from './folding'
import type { GridPosition, FrameRef } from './grid'
import { columnCycle, rowCycle, type Weave } from './weave'
import { shapeSide } from './frameShape'
import { heldWeave, type Layered, startingRowProgressOf, frameById } from './layerRecord'
import { shownBeads } from './layers'
import { canvasRectCentre, extentMmOf } from './sheets'
import { touchFrameSheet } from './frameSheet'
import type { FrameLayer, Project } from './project'
import { clampPointer } from './rowProgress'
import { frameQuarterTurnOf, type TablePoint } from './table'

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
// least one bead each way. Worked out in the Frame's own rows and columns, whose first are always unshifted (ticket 492);
// the rectangle it gives is in them too, its first row and column how far the Frame's own first moved.
export function frameWithEdges(weave: Weave, frame: Pick<Rect, 'rows' | 'columns'>, edges: readonly FrameEdge[], cell: GridPosition): Rect {
  let top = 0
  let bottom = frame.rows - 1
  let left = 0
  let right = frame.columns - 1
  const at = cell

  if (edges.includes('top')) top = Math.min(snapRow(weave, at.row), bottom)
  if (edges.includes('bottom')) bottom = Math.max(at.row, top)
  if (edges.includes('left')) left = Math.min(snapColumn(weave, at.column), right)
  if (edges.includes('right')) right = Math.max(at.column, left)

  return { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** The Frame with its size changed from the top-left corner, which stays where it is; never smaller than one bead
 * each way. */
export function frameWithSize(columns: number, rows: number): Rect {
  return { row: 0, column: 0, columns: Math.max(1, Math.round(columns)), rows: Math.max(1, Math.round(rows)) }
}

/** The fewest beads a side of the Frame keeps when stepped or typed (ticket 473), and the most a typed side takes: the
 * range the Frame panel's size fields say when they bring a number into it (ticket 0978). */
export const FEWEST_SIDE = 4
export const MAX_TYPED_SIDE = 999

// The Frame with one edge moved a bead out (`step` 1) or in (`step` -1), the others staying put (Edit Frame's steppers,
// ticket 417). The top edge goes by a whole cycle of rows (brick stitch) and the left by one of columns (peyote, ticket
// 0734), as dragging does. A step that would leave less than four beads each way changes nothing (ticket 473).
export function frameWithEdgeStep<T extends Pick<Rect, 'rows' | 'columns'>>(weave: Weave, frame: T, edge: FrameEdge, step: 1 | -1): T | Rect {
  const rowStep = rowCycle(weave) * step
  const columnStep = columnCycle(weave) * step
  const own: Rect = { row: 0, column: 0, rows: frame.rows, columns: frame.columns }
  switch (edge) {
    case 'left':
      return step < 0 && frame.columns + columnStep < FEWEST_SIDE ? frame : { ...own, column: -columnStep, columns: frame.columns + columnStep }
    case 'right':
      return step < 0 && frame.columns + step < FEWEST_SIDE ? frame : { ...own, columns: frame.columns + step }
    case 'top':
      return step < 0 && frame.rows + rowStep < FEWEST_SIDE ? frame : { ...own, row: -rowStep, rows: frame.rows + rowStep }
    case 'bottom':
      return step < 0 && frame.rows + step < FEWEST_SIDE ? frame : { ...own, rows: frame.rows + step }
  }
}

/** The Frame resized to `columns` × `rows`, each side changing evenly on both edges (ticket 473), the right or bottom
 * taking an odd change's extra bead. Where rows alternate the top edge moves by whole cycles, and where columns do the
 * left edge (ticket 0734). A side keeps between FEWEST_SIDE and MAX_TYPED_SIDE beads. */
export function frameResizedAround(weave: Weave, frame: Pick<Rect, 'rows' | 'columns'>, columns: number, rows: number): Rect {
  const side = (n: number) => Math.min(MAX_TYPED_SIDE, Math.max(FEWEST_SIDE, Math.round(n)))
  const wide = side(columns)
  const tall = side(rows)
  const [across, down] = [columnCycle(weave), rowCycle(weave)]
  const left = across > 1 ? across * Math.trunc((wide - frame.columns) / (2 * across)) : Math.trunc((wide - frame.columns) / 2)
  const top = down > 1 ? down * Math.trunc((tall - frame.rows) / (2 * down)) : Math.trunc((tall - frame.rows) / 2)
  return { row: -top || 0, column: -left || 0, rows: tall, columns: wide }
}

/** The Frame that wraps every Canvas bead drawn (Fit to drawing), or undefined when there is none. Canvas beads under a
 * Frame's sheet are not drawn, so they are not wrapped (spec 1234). */
export function fitToDrawing(project: Layered): Rect | undefined {
  const bounds = beadBounds(shownBeads(project))
  if (!bounds) {
    return undefined
  }
  const canvasWeave = heldWeave(project, 'canvas')
  const [top, left] = [snapRow(canvasWeave, bounds.row), snapColumn(canvasWeave, bounds.column)]
  return { row: top, column: left, rows: bounds.row + bounds.rows - top, columns: bounds.column + bounds.columns - left }
}

/** Where a Frame resized to its own `rectangle` lies on the Table, its centre in mm (spec 1234): along each side as seen,
 * the edge whose own edge did not move stays; where both did (a typed size), the change is shared as they grew. */
function resizedCentre(project: Project, current: FrameLayer, rectangle: Rect, ref: FrameRef): TablePoint {
  const turns = current.quarterTurns ?? 0
  const grew: Record<FrameEdge, number> = {
    top: -rectangle.row,
    left: -rectangle.column,
    bottom: rectangle.row + rectangle.rows - current.rows,
    right: rectangle.column + rectangle.columns - current.columns,
  }
  const [was, now] = [extentMmOf(project, ref, current), extentMmOf(project, ref, { ...current, rows: rectangle.rows, columns: rectangle.columns })]
  const share = (first: FrameEdge, last: FrameEdge) => {
    const [before, after] = [Math.abs(grew[shapeSide(first, turns)]), Math.abs(grew[shapeSide(last, turns)])]
    return before + after === 0 ? 0.5 : before / (before + after)
  }
  const [left, top] = [current.centre.x - was.x / 2, current.centre.y - was.y / 2]
  return { x: left - (now.x - was.x) * share('left', 'right') + now.x / 2, y: top - (now.y - was.y) * share('top', 'bottom') + now.y / 2 }
}

/** The Project with the Frame named removed (ADR 0026, 0066): with it go its passes (ticket 426), Row progress being the
 * Frame's (ADR 0079). The Canvas is never touched (ticket 1215). */
export function withoutFrame(project: Project, ref: FrameRef): Project {
  return touchFrameSheet(project, undefined, { frame: ref })
}

/** The Project with its Frame resized to `rectangle`, in its own rows and columns: its first row and column are how far
 * its own first moved, its rows and columns its new size (ADR 0026, 0066). Its beads keep their place, those outside a
 * smaller Frame fold and show again when it grows back (ticket 1215), Row progress stays inside it; an unchanged Frame is
 * the same Project. Where it lies on the Table follows its edges (`resizedCentre`). */
export function withFrameResized(project: Project, rectangle: Rect, ref: FrameRef): Project {
  const current = frameById(project, ref)
  if (!current || sameFrame({ rows: current.rows, columns: current.columns }, rectangle)) {
    return project
  }
  const { rows, columns } = rectangle
  const holds = (at: GridPosition) => at.row >= 0 && at.row < rows && at.column >= 0 && at.column < columns
  const refit: SheetBeads = refitSheet(current, { row: rectangle.row, column: rectangle.column }, holds)
  const frame: FrameSheet & { centre: TablePoint } = {
    centre: resizedCentre(project, current, rectangle, ref),
    rows,
    columns,
    beads: refit.beads,
    ...(refit.folded ? { folded: refit.folded } : {}),
    ...heldWeave(project, ref)!,
    ...(current.name ? { name: current.name } : {}),
    ...(current.shape ? { shape: current.shape } : {}),
    ...(current.settings ? { settings: current.settings } : {}),
    ...(current.quarterTurns ? { quarterTurns: current.quarterTurns } : {}),
  }
  return touchFrameSheet(project, { ...frame, rowProgress: clampPointer(current.rowProgress, frame, frameQuarterTurnOf(project, ref)) }, { frame: ref })
}

/** The Project with a new empty Frame on a rectangle of the Canvas's positions, as the Canvas is woven (ticket 492), lying
 * where those positions lie on the Table, so it starts where its copied beads are (spec 1234). Its Row progress starts
 * afresh (spec 1182); any Frame of that name is replaced. */
export function withFrameMadeOn(project: Project, rectangle: Rect, ref: FrameRef): Project {
  const { rows, columns } = rectangle
  const frame: FrameSheet & { centre: TablePoint } = { centre: canvasRectCentre(project, rectangle), rows, columns, beads: {}, ...heldWeave(project, 'canvas')! }
  return touchFrameSheet(project, { ...frame, rowProgress: startingRowProgressOf(frame) }, { anew: true, frame: ref })
}
