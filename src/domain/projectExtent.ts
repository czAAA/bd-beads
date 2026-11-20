import { beadBounds, frameDimensions, type Rect } from './canvas'
import { laidRect, seenSize } from './frameOrientation'
import { frameShapeOf } from './frameShape'
import type { GridDimensions, GridPosition } from './grid'
import { beadsOfLayer, frameOf, type Layered } from './layerRecord'
import { projectCell } from './projectBead'

// How far a Project reaches: its Frame, or the box round its beads when it has none, and that size in beads.

/** The Project's Frame as it lies on the Canvas (turned, ticket 0667), or for a Canvas without one the smallest box
 * round its beads (nothing for an empty one). For the parts of the app that still think in a Project's extent. */
export function projectFrame(project: Layered): Rect {
  const frame = frameOf(project)
  if (frame) return laidRect({ ...frame, ...(frame.quarterTurns ? { cell: projectCell(project) } : {}) })
  return beadBounds(beadsOfLayer(project, 'canvas')) ?? { row: 0, column: 0, columns: 0, rows: 0 }
}

/** What the open Project's Frame measures in beads as it lies: what the person is told the size is, and what the
 * rulers and the printed pages number. */
export function projectDimensions(project: Layered): GridDimensions {
  return frameDimensions(projectFrame(project))
}

/** What the Project measures in beads as the person is told it: its Frame's Width and Height as seen (a turned plain
 * Frame's own swapped, ticket 0667), or the box round its beads. */
export function shownDimensions(project: Layered): GridDimensions {
  const frame = frameOf(project)
  return frame ? seenSize(frame) : projectDimensions(project)
}

/** The box round the Frame's beads in its own rows and columns: what the printed chart, Row by row and the tech line are
 * trimmed to (ticket 1128). None for a Frame with no beads, or with a Frame shape, whose beads keep no rows and columns. */
export function paintedFrameBox(project: Layered): Rect | undefined {
  const frame = frameOf(project)
  if (!frame || frameShapeOf(frame)) return undefined
  return beadBounds(beadsOfLayer(project, 'frame')!)
}

/** Whether a position lies inside a box, or anywhere when there is none (a Frame `paintedFrameBox` does not trim). */
export function inBox(box: Rect | undefined, { row, column }: GridPosition): boolean {
  return !box || (row >= box.row && row < box.row + box.rows && column >= box.column && column < box.column + box.columns)
}
