import type { FrameSheet, Rect } from './canvas'
import { frameShapeOf } from './frameShape'
import type { GridDimensions } from './grid'
import { turnedGridSize } from './layerGeometry'
import { frameWeave } from './layerWeave'
import type { Weave } from './weave'
import { type Layered, frameOf } from './layerRecord'

// A Frame's orientation (ADR 0079, ticket 0667): Rotate Frame turns the Frame on the Canvas like a sheet of A4 on an A1.
// Its beads keep their own rows and columns; what turns is the rectangle it covers on the Canvas, which this says.

/** A Frame as what it covers is worked out from: its own size, its Frame shape and turn, and its Weave with the Bead shape's
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
