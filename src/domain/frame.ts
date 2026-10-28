import { footprintOf } from './footprint'
import { beadBounds, beadsOver, beadsWithout, sameFrame, shiftedBeads, type BeadMap, type FrameSheet, type Rect } from './canvas'
import { refitSheet } from './folding'
import type { GridPosition } from './grid'
import { DEFAULT_TECHNIQUE, describeWeave, rowCycle, type Weave } from './weave'
import { withMargin } from './margin'
import { canvasDistance, canvasWeave, weaveOf } from './layerWeave'
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

/** The column a Frame may start on: the column itself, or the nearest start of a diamond to its left where a net's
 * lattice repeats across (ticket 485). */
export function snapColumn(weave: Weave, column: number): number {
  const step = describeWeave(weave).columnStep
  return column - (((column % step) + step) % step)
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

  const { smallest, snapBottom, snapRight } = describeWeave(weave)
  if (edges.includes('top')) top = Math.min(snapRow(weave, at.row), snapBottom(top, bottom) - smallest.rows + 1)
  if (edges.includes('bottom')) bottom = snapBottom(top, Math.max(at.row, top + smallest.rows - 1))
  if (edges.includes('left')) left = Math.min(snapColumn(weave, at.column), right - smallest.columns + 1)
  if (edges.includes('right')) right = snapRight(left, Math.max(at.column, left + smallest.columns - 1))

  return { row: frame.row + top, column: frame.column + left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** A move counted in whole Canvas positions (ticket 492): the Frame's own first row is always an unshifted one, so no
 * stagger is kept; where a Unit takes more than one row or column the move goes by whole Units, so its corner stays
 * on one. */
export function snappedMove(canvas: Weave, rows: number, columns: number): { rows: number; columns: number } {
  const { rowsPerUnit, columnStep } = describeWeave(canvas)
  const by = (distance: number, step: number) => (step > 1 ? Math.sign(distance) * Math.round(Math.abs(distance) / step) * step : distance)
  return { rows: by(rows, rowsPerUnit), columns: by(columns, columnStep) }
}

/** The Frame moved by whole Canvas positions. */
export function movedFrame(frame: Rect, rows: number, columns: number): Rect {
  return { ...frame, row: frame.row + rows, column: frame.column + columns }
}

/** The Frame with its size changed from the top-left corner, which stays where it is; never smaller than one bead
 * each way. */
export function frameWithSize(frame: Rect, columns: number, rows: number, weave: Weave = { technique: DEFAULT_TECHNIQUE }): Rect {
  const { smallest, snapBottom, snapRight } = describeWeave(weave)
  const tall = snapBottom(0, Math.max(smallest.rows, Math.round(rows)) - 1) + 1
  const wide = snapRight(0, Math.max(smallest.columns, Math.round(columns)) - 1) + 1
  return { ...frame, columns: wide, rows: tall }
}

const MIN_STEPPED_SIDE = 4
const MAX_TYPED_SIDE = 999

// The Frame with one edge moved a bead out (`step` 1) or in (`step` -1), the others staying put (Edit Frame's steppers,
// ticket 417). Where rows alternate (peyote, brick stitch) the top edge goes by a whole cycle of rows so the first row
// keeps its place, as dragging the top handle does. A step that would leave less than four beads each way changes nothing (ticket 473).
export function frameWithEdgeStep(weave: Weave, frame: Rect, edge: FrameEdge, step: 1 | -1): Rect {
  const description = describeWeave(weave)
  const rowStep = rowCycle(weave) * step
  const columnStep = description.columnStep * step
  // A net's smallest Frame is a diamond, wider than the four beads other Techniques keep.
  const fewest = { columns: Math.max(MIN_STEPPED_SIDE, description.smallest.columns), rows: Math.max(MIN_STEPPED_SIDE, description.smallest.rows) }
  switch (edge) {
    case 'left':
      return step < 0 && frame.columns + columnStep < fewest.columns ? frame : { ...frame, column: frame.column - columnStep, columns: frame.columns + columnStep }
    case 'right':
      return step < 0 && frame.columns + columnStep < fewest.columns ? frame : { ...frame, columns: frame.columns + columnStep }
    case 'top':
      return step < 0 && frame.rows + rowStep < fewest.rows ? frame : { ...frame, row: frame.row - rowStep, rows: frame.rows + rowStep }
    case 'bottom': {
      const down = description.rowsPerUnit * step
      return step < 0 && frame.rows + down < fewest.rows ? frame : { ...frame, rows: frame.rows + down }
    }
  }
}

/** The Frame resized to `columns` × `rows` (Units where counted), each side changing evenly on both edges (ticket 473),
 * the right or bottom taking an odd change's extra bead. Where rows alternate the top edge moves by whole cycles. A side
 * keeps between the Technique's fewest typed side (four beads, or one Unit) and MAX_TYPED_SIDE beads. */
export function frameResizedAround(weave: Weave, frame: Rect, columns: number, rows: number): Rect {
  const description = describeWeave(weave)
  const typed = description.positionsOf({ columns, rows })
  const side = (n: number, fewest: number) => Math.min(MAX_TYPED_SIDE, Math.max(fewest, Math.round(n)))
  const fewest = description.positionsOf({ columns: description.policy.fewestTypedSide, rows: description.policy.fewestTypedSide })
  const wide = side(typed.columns, fewest.columns)
  const tall = description.snapBottom(0, side(typed.rows, fewest.rows) - 1) + 1
  const across = description.columnStep
  const left = across > 1 ? across * Math.trunc((wide - frame.columns) / (2 * across)) : Math.trunc((wide - frame.columns) / 2)
  const cycle = rowCycle(weave)
  const top = cycle > 1 ? cycle * Math.trunc((tall - frame.rows) / (2 * cycle)) : Math.trunc((tall - frame.rows) / 2)
  return { row: frame.row - top, column: frame.column - left, rows: tall, columns: wide }
}

/** The Frame that wraps every bead drawn (Fit to drawing), or undefined when there is none: the Frame's own beads and
 * the Canvas's that show. Canvas beads under the Frame or in its margin are not drawn, so they are not wrapped. */
export function fitToDrawing(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'beads' | 'frame'>): Rect | undefined {
  const frame = project.frame
  const covered = footprintOf(project)
  const shown = frame && covered ? beadsOver(beadsWithout(project.beads, withMargin(covered)), shiftedBeads(frame.beads, frame.row, frame.column)) : project.beads
  const bounds = beadBounds(shown)
  if (!bounds) {
    return undefined
  }
  const top = snapRow(project, bounds.row)
  const bottom = describeWeave(project).snapBottom(top, bounds.row + bounds.rows - 1)
  const left = snapColumn(project, bounds.column)
  const right = describeWeave(project).snapRight(left, Math.max(bounds.column + bounds.columns - 1, left + describeWeave(project).smallest.columns - 1))
  return { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** Where a resized Frame's first row and column go, as Canvas positions. The rectangle is in the Frame's own rows and
 * columns, so an edge moved by some of them moves the Frame's corner by as far on the Canvas. */
function resizedOrigin(project: Project, current: FrameSheet, rectangle: Rect): GridPosition {
  const moved = canvasDistance(project, current, rectangle.row - current.row, rectangle.column - current.column)
  return { row: current.row + moved.row, column: current.column + moved.column }
}

/** The Project with its Frame set to a rectangle of the Canvas, or removed (ADR 0026, 0066): its beads keep their
 * place, those outside a smaller Frame are dropped or, woven unlike the Canvas, folded (ticket 0638), the Canvas is
 * never touched, a Frame set anew is empty, Row progress stays inside it; an unchanged Frame is the same Project. */
export function withFrame(project: Project, rectangle: Rect | undefined): Project {
  return withFrameGiving(project, rectangle).project
}

/** `withFrame`, and the beads the resized Frame gives up to the Canvas, by Canvas position: those it no longer holds
 * where it is woven like the Canvas, none where it folds them (ticket 0638). The resize lays them there. */
export function withFrameGiving(project: Project, rectangle: Rect | undefined): { project: Project; given: BeadMap } {
  if (sameFrame(project.frame, rectangle)) {
    return { project, given: {} }
  }
  const { frame: current, ...rest } = project
  // With the Frame gone the passes are gone too (ticket 426).
  if (!rectangle) {
    return { project: { ...rest, rowProgress: firstPasses(project.rowProgress), updatedAt: Date.now() }, given: {} }
  }
  const { rows, columns } = rectangle
  const { row, column } = current ? resizedOrigin(project, current, rectangle) : rectangle
  const holds = (at: GridPosition) => at.row >= 0 && at.row < rows && at.column >= 0 && at.column < columns
  // A resized Frame keeps what it holds, folds or gives up the rest (ticket 0638); one made anew is empty.
  const refit = current ? refitSheet(current, canvasWeave(project), { row: rectangle.row - current.row, column: rectangle.column - current.column }, holds) : { beads: {}, given: {} }
  const frame: FrameSheet = {
    row,
    column,
    rows,
    columns,
    beads: refit.beads,
    ...(refit.folded ? { folded: refit.folded } : {}),
    // A Frame made anew is woven as the Canvas is (ticket 492); one resized keeps its own.
    ...weaveOf(current ?? project),
    ...(current?.name ? { name: current.name } : {}),
    ...(current?.kind ? { kind: current.kind } : {}),
    ...(current?.settings ? { settings: current.settings } : {}),
    ...(current?.quarterTurns ? { quarterTurns: current.quarterTurns } : {}),
  }
  return { project: { ...rest, frame, rowProgress: clampPointer(project.rowProgress, frame), updatedAt: Date.now() }, given: shiftedBeads(refit.given, row, column) }
}
