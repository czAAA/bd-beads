import { nearestQuarterTurn, normalizedOrientation } from './canvasOrientation'
import type { Rotation } from './grid'
import { canvasOf, frameOf, withCanvas, withFrameFields, type Layered } from './layerRecord'
import type { Project } from './project'
import { turnedWithFrame } from './rowWays'

// The table (spec 1182, ticket 1185): the one plane pan and zoom move. Each layer has a placement on it, an angle in
// degrees and a position: the Canvas's orientation and origin, the Frame's own angle and centre (framePlacement.ts).
// A Project keeps the Canvas's origin as the table's own, so where a turn's pivot is only moves the view.

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
  return { angle: canvasOf(project).orientation, at: { x: 0, y: 0 } }
}

/** The Frame's own angle on the table (spec 1182); with no Frame, the Canvas's, as a new Frame would lie. */
export function frameAngleOf(project: Layered): number {
  return frameOf(project)?.angle ?? canvasOf(project).orientation
}

/** The quarter turn the Frame's angle is nearest: what it is read by (its Row direction as seen, and the Frame's own
 * axis and end worked from it, ticket 1185). Its lean, until 1188 the Canvas's, is only the view's. */
export function frameQuarterTurnOf(project: Layered): Rotation {
  return nearestQuarterTurn(frameAngleOf(project))
}

/** Whether the Frame lies alike with the Canvas (spec 1182): at its angle and on whole positions, its cells on the
 * Canvas's (a Custom frame's turned layout is built on its grid, so whole quarters off still do). What every rule that
 * trades beads, steps by whole positions or needs plain rows asks; true with no Frame. */
export function lieAlike(project: Layered): boolean {
  const frame = frameOf(project)
  if (!frame) return true
  const off = normalizedOrientation(frame.angle - canvasOf(project).orientation)
  const onGrid = frame.shape ? off % 90 === 0 : off === 0
  return onGrid && Number.isInteger(frame.row) && Number.isInteger(frame.column)
}

/** The Project with its Canvas turned to `orientation` (its placement on the table, about whatever pivot), carrying the
 * Frame until 1188: the Frame's angle turned as far and its Row progress kept on its own rows, so nothing looks
 * different. A Custom frame's runs one way and stays. Not stamped. */
export function withCanvasTurned(project: Project, orientation: number): Project {
  const [from, to] = [canvasOf(project).orientation, normalizedOrientation(orientation)]
  if (from === to) return project
  const turned = withCanvas(project, { orientation: to })
  const frame = project.layers[1]
  if (!frame) return turned
  const angle = normalizedOrientation(frame.angle + to - from)
  const turns = (nearestQuarterTurn(angle) - nearestQuarterTurn(frame.angle)) / 90
  return withFrameFields(turned, { angle, ...(frame.shape ? {} : { rowProgress: turnedWithFrame(frame.rowProgress, turns) }) })
}
