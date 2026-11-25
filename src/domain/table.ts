import { nearestQuarterTurn, normalizedOrientation } from './canvasOrientation'
import type { FrameRef, Rotation } from './grid'
import { canvasOf, frameById, type Layered } from './layerRecord'

// The Table (spec 1234, ticket 1237): the one plane every layer lies on, measured in mm, which pan and zoom move. Each
// layer lies on it by a place and a quarter turn: the Canvas by its origin and orientation, a Frame by its centre and
// angle (framePlacement.ts). The Table turn shows the whole Table turned on screen, every layer together; it is a view.

/** A point on the Table, in mm along its own axes (the Table before the Table turn); the view's own points
 * (framePlacement.ts) are in the Canvas's bead widths, as laid on screen. */
export interface TablePoint {
  x: number
  y: number
}

/** A point turned `degrees` clockwise about the origin, with y running down, exact at a quarter turn. */
export function turnedPoint({ x, y }: TablePoint, degrees: number): TablePoint {
  const radians = (degrees * Math.PI) / 180
  const quarter = degrees % 90 === 0
  const cos = quarter ? Math.round(Math.cos(radians)) : Math.cos(radians)
  const sin = quarter ? Math.round(Math.sin(radians)) : Math.sin(radians)
  return { x: x * cos - y * sin || 0, y: x * sin + y * cos || 0 }
}

/** A length in mm kept to a millionth of a mm, as a file stores a centre: what a read centre is rounded to, so the Project
 * reads back the same as it is written (ticket 1237). */
export function roundedMm(value: number): number {
  return Math.round(value * 1e6) / 1e6 || 0
}

/** The Table turn (spec 1234): how far the whole Table is shown turned, in degrees clockwise, 0 when upright. */
export function tableTurnOf(project: Layered): number {
  return canvasOf(project).tableTurn ?? 0
}

/** The Canvas's angle on screen: its own quarter turn on the Table and the Table turn.
 * @internal Tests ask the Canvas angle on screen directly.
 */
export function canvasAngleOf(project: Layered): number {
  return normalizedOrientation(canvasOf(project).orientation + tableTurnOf(project))
}

/** The Frame's own quarter turn on the Table (spec 1234), 0 for a Frame the Project lacks: what its Row direction as seen,
 * its rulers, its sizes as seen and its exports go by. The Table turn changes none of them. */
export function frameQuarterTurnOf(project: Layered, frame: FrameRef): Rotation {
  return nearestQuarterTurn(frameById(project, frame)?.angle ?? 0)
}

/** The Frame's angle on screen: its own quarter turn on the Table and the Table turn; with no Frame, the Canvas's, as a
 * new Frame would lie. */
export function frameAngleOf(project: Layered, frame: FrameRef): number {
  const held = frameById(project, frame)
  return held ? normalizedOrientation(held.angle + tableTurnOf(project)) : canvasAngleOf(project)
}
