import type { FrameSheet, Rect } from './canvas'
import type { FrameEdge } from './frame'
import { frameShapeOf, shapeSide, turnedGrid } from './frameShape'
import type { GridDimensions, GridPosition } from './grid'
import { turnedGridSize } from './layerGeometry'
import { frameWeave } from './layerWeave'
import { columnCycle, rowCycle, type Weave } from './weave'
import { type Layered, frameOf } from './layerRecord'

// A Frame's orientation (ADR 0079, ticket 0667): Rotate Frame turns the Frame on the Canvas like a sheet of A4 on an A1.
// Its beads keep their own rows and columns; what turns is the rectangle it covers on the Canvas, which this says.

/** A Frame as what it covers is worked out from: its own size, its Frame shape and turn, and its Weave with the Bead's
 * cell. */
type Oriented = Pick<FrameSheet, 'rows' | 'columns' | 'shape' | 'quarterTurns'> & Weave

/** The rows and columns of its own Weave's cells a Frame covers on the Canvas as it lies: a Custom frame's rectangle,
 * which its turned layout already sets, or a Frame's own rows and columns, turned (Width and Height swap as
 * seen). */
export function laidSize(frame: Oriented): GridDimensions {
  return frameShapeOf(frame) ? { rows: frame.rows, columns: frame.columns } : turnedGridSize(frame)
}

/** The rectangle a Frame covers on the Canvas as it lies (ticket 0667), from its first row and column: the Frame itself
 * where that is its own rectangle (upright, or a Custom frame). What its footprint, margin, line and handles go by; not
 * a Frame, whose own rows and columns its geometry is built from. */
export function laidRect(frame: Rect & Oriented): Rect {
  if (!frame.quarterTurns || frameShapeOf(frame)) return frame
  return { row: frame.row, column: frame.column, ...laidSize(frame) }
}

/** The rectangle the Project's Frame covers on the Canvas as it lies (see `laidRect`), in its Weave with the Bead
 * shape's cell; none without a Frame. */
export function laidFrame(project: Layered): Rect | undefined {
  const frame = frameOf(project)
  if (!frame?.quarterTurns) return frame
  return laidRect({ ...frame, ...frameWeave(project) })
}

/** A Frame's Width and Height as seen (ticket 0667): a Frame's own columns and rows, swapped while it lies a
 * quarter or three quarters round; a Custom frame's rectangle, which already lies as it is turned. */
export function seenSize(frame: Pick<FrameSheet, 'rows' | 'columns' | 'shape' | 'quarterTurns'>): GridDimensions {
  const across = (frame.quarterTurns ?? 0) % 2 === 1 && !frameShapeOf(frame)
  return across ? { columns: frame.rows, rows: frame.columns } : { columns: frame.columns, rows: frame.rows }
}

/** The Frame's own edge that a resize handle or stepper on an edge as seen moves (ticket 1016): the one lying under it,
 * turned a quarter clockwise its top on the right; upright, or a Custom frame (whose rectangle already lies as seen), the
 * same edge. */
export function ownEdge(frame: Pick<FrameSheet, 'shape' | 'quarterTurns'>, seen: FrameEdge): FrameEdge {
  return turnedGrid(frame) ? shapeSide(seen, frame.quarterTurns) : seen
}

/** The own rows and columns a Width and Height typed as seen ask of a Frame (ticket 1016): `seenSize` undone. */
export function ownSize(frame: Pick<FrameSheet, 'shape' | 'quarterTurns'>, seen: GridDimensions): GridDimensions {
  return seenSize({ ...frame, ...seen })
}

/** A turned Frame with the given edges as seen dragged to a bead `cell` of the rectangle it lies in (ticket 1016), as
 * `frameWithEdges` drags an upright one: the own rectangle a resize sets, each own edge under a dragged one moved by its
 * own steps (whole cycles for its top and left) to the count whose turned extent comes nearest the pointer. */
export function turnedWithEdges(frame: Rect & Oriented, edges: readonly FrameEdge[], cell: GridPosition): Rect {
  const laid = laidRect(frame)
  const at = { row: cell.row - frame.row, column: cell.column - frame.column }
  const asked: Record<FrameEdge, number> = { top: laid.rows - at.row, bottom: at.row + 1, left: laid.columns - at.column, right: at.column + 1 }
  const own: Rect = { row: frame.row, column: frame.column, rows: frame.rows, columns: frame.columns }
  return edges.reduce((rect, seen) => withOwnSide(frame, rect, seen, asked[seen]), own)
}

/** `rect` with the own edge under the seen edge moved so the turned Frame reaches `wanted` rows or columns that way as
 * it lies, or as near as its steps come. Between two as near the larger, so an edge goes out as soon as an upright one
 * would and comes in a whole step later; between counts that lie as large, the one nearest where it was. */
function withOwnSide(frame: Oriented, rect: Rect, seen: FrameEdge, wanted: number): Rect {
  const own = ownEdge(frame, seen)
  const across = own === 'top' || own === 'bottom' ? 'rows' : 'columns'
  const along = seen === 'top' || seen === 'bottom' ? 'rows' : 'columns'
  const step = own === 'top' ? rowCycle(frame) : own === 'left' ? columnCycle(frame) : 1
  const count = rect[across]
  const reach = (n: number) => laidSize({ ...frame, rows: rect.rows, columns: rect.columns, [across]: n })[along]
  let best = { n: count, off: Infinity, reach: 0 }
  // Turned, a count lies at most a few times longer or shorter than it is (a Bead's cell is never 4 times as tall as wide).
  const most = Math.max(count, wanted) * 4 + 8
  for (let n = ((count - 1) % step) + 1; n <= most; n += step) {
    const each = { n, reach: reach(n), off: Math.abs(reach(n) - wanted) }
    const nearer = each.off < best.off || (each.off === best.off && (each.reach > best.reach || (each.reach === best.reach && Math.abs(n - count) < Math.abs(best.n - count))))
    if (nearer) best = each
  }
  const grown = best.n - count
  return {
    row: own === 'top' ? rect.row - grown : rect.row,
    column: own === 'left' ? rect.column - grown : rect.column,
    rows: across === 'rows' ? best.n : rect.rows,
    columns: across === 'columns' ? best.n : rect.columns,
  }
}
