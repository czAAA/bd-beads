import { nearestQuarterTurn, normalizedOrientation, settledOrientation } from './canvasOrientation'
import type { FrameRef, Rotation } from './grid'
import { canvasOf, frameById, type Layered } from './layerRecord'

// The table (spec 1182, ticket 1185): the one plane pan and zoom move. Each layer has a placement on it, an angle in
// degrees and a position: the Canvas's orientation and origin, the Frame's own angle and centre (framePlacement.ts).
// A file keeps the Canvas's origin as the table's own; in a session a turn about a pivot moves it (ticket 1188).

/** A point on the table, from the Canvas's origin along the table's own axes, in the Canvas's bead widths. */
export interface TablePoint {
  x: number
  y: number
}

/** A layer's placement on the table: its angle in degrees clockwise and where it sits. */
export interface Placement {
  angle: number
  at: TablePoint
}

/** The Canvas's placement: its orientation, its origin the table's. */
export function canvasPlacement(project: Layered): Placement {
  const { orientation, origin } = canvasOf(project)
  return { angle: orientation, at: origin ? { ...origin } : { x: 0, y: 0 } }
}

/** The Frame's own angle on the table (spec 1182); with no Frame, the Canvas's, as a new Frame would lie. */
export function frameAngleOf(project: Layered, frame: FrameRef): number {
  return frameById(project, frame)?.angle ?? canvasOf(project).orientation
}

/** The quarter turn the Frame's angle is nearest: what it is read by (its Row direction as seen, and the Frame's own
 * axis and end worked from it, ticket 1185). Its lean is only the view's. */
export function frameQuarterTurnOf(project: Layered, frame: FrameRef): Rotation {
  return nearestQuarterTurn(frameAngleOf(project, frame))
}

/** Where a Frame twisted to `angle` comes to rest as the fingers lift (spec 1182, ticket 1190): on the Canvas's angle,
 * or a quarter off it, within about 10°, else on the screen's nearest quarter turn within about 10°, else leaning. */
export function settledFrameAngle(project: Layered, angle: number): number {
  return settledOrientation(angle, [canvasOf(project).orientation, 0])
}

/** Whether the Frame lies alike with the Canvas (spec 1182): at its angle and on whole positions, its cells on the
 * Canvas's (a Custom frame's turned layout is built on its grid, so whole quarters off still do). What every rule that
 * trades beads, steps by whole positions or needs plain rows asks; true with no Frame. */
export function lieAlike(project: Layered, ref: FrameRef): boolean {
  const frame = frameById(project, ref)
  if (!frame) return true
  const off = normalizedOrientation(frame.angle - canvasOf(project).orientation)
  const onGrid = frame.shape ? off % 90 === 0 : off === 0
  return onGrid && !frame.centre && Number.isInteger(frame.row) && Number.isInteger(frame.column)
}

/** Whether the Frame lies on the Canvas's grid (ticket 1188): whole quarter turns off its angle, on whole positions, so
 * it covers Canvas positions (its footprint) and its margin is theirs. Off it, it is only a sheet laid over the
 * Canvas, hiding what is under it on screen and covering no position. False with no Frame. */
export function liesOnGrid(project: Layered, ref: FrameRef): boolean {
  const frame = frameById(project, ref)
  return !!frame && !frame.centre && normalizedOrientation(frame.angle - canvasOf(project).orientation) % 90 === 0
}
