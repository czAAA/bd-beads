import { nearestQuarterTurn, normalizedOrientation } from '../domain/canvasOrientation'
import { frameCentreOnCanvas } from '../domain/framePlacement'
import type { FrameRef, Rotation } from '../domain/grid'
import { frameById, layerOf, type Layered } from '../domain/layerRecord'
import { placedFrame } from '../domain/layerWeave'
import { frameAngleOf } from '../domain/table'
import { CELL_SIZE_PX } from './cellSize'
import { frameMiddlePx, type Scroll, type SurfaceView } from './surfaceView'

/** The quarter turn a Frame's own drawing is at (ticket 1187): its nearest on the Table, less its own turns. */
export function frameRotation(project: Layered, ref: FrameRef): Rotation {
  const angle = frameAngleOf(project, ref)
  return normalizedOrientation(nearestQuarterTurn(angle) - 90 * (frameById(project, ref)?.quarterTurns ?? 0)) as Rotation
}

/** Where a Frame's centre is in a view of the Canvas's drawing. */
export function frameCentreIn(project: Layered, view: SurfaceView, ref: FrameRef): Scroll {
  const centre = frameCentreOnCanvas(project, ref)!
  return view.gridToPoint(centre.x * CELL_SIZE_PX, centre.y * CELL_SIZE_PX)
}

/** Where a Frame's middle is in its own drawing, which holds the Frame from its first position's corner (spec 1234). */
export function frameMiddleIn(project: Layered, view: SurfaceView, ref: FrameRef): Scroll {
  const middle = frameMiddlePx(placedFrame(project, ref)!, layerOf(project, 'canvas').weave.cell)
  return view.gridToPoint(middle.x, middle.y)
}
