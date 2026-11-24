import { normalizedOrientation } from './canvasOrientation'
import { framePlacement, laidExtent, withFrameTurnedTo } from './framePlacement'
import type { FrameRef } from './grid'
import { frameById, frameIdOf, framesOf, type Layered } from './layerRecord'
import { canvasWeave } from './layerWeave'
import { MARGIN } from './margin'
import type { Project } from './project'
import { frameAngleOf, type TablePoint } from './table'
import { positionStep } from './weave'

// Frames never meet (spec 1214, ticket 1218): a Frame plus its Keep-out margin never touches another Frame plus its
// margin. Each is a rectangle on the table, turned at its own angle, so the rule holds on the Canvas's grid and off it.

/** A Frame with its margin as it lies on the table: its centre, the angle its laid rectangle lies at and its half reach
 * along that rectangle's own axes, in the Canvas's bead widths. */
interface SheetBox {
  at: TablePoint
  angle: number
  half: TablePoint
}

/** How far two boxes must overlap to meet, in bead widths: boxes that only share an edge are clear. */
const TOUCH = 1e-6

/** The box a Frame and its margin take on the table. The Project must have that Frame. */
function boxOf(project: Layered, ref: FrameRef): SheetBox {
  const { at } = framePlacement(project, ref)!
  // Its laid rectangle already stands its quarter turns; only the lean left over turns the box.
  const angle = frameAngleOf(project, ref) - 90 * (frameById(project, ref)!.quarterTurns ?? 0)
  const extent = laidExtent(project, ref)
  const step = positionStep(canvasWeave(project))
  return { at, angle, half: { x: extent.x / 2 + MARGIN * step.across, y: extent.y / 2 + MARGIN * step.down } }
}

/** A box's two axes on the table, its angle clockwise with y running down. */
function axesOf({ angle }: SheetBox): [TablePoint, TablePoint] {
  const radians = (angle * Math.PI) / 180
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)]
  return [
    { x: cos, y: sin },
    { x: -sin, y: cos },
  ]
}

/** Whether two boxes overlap: no axis of either separates them. */
function boxesMeet(a: SheetBox, b: SheetBox): boolean {
  const [axesA, axesB] = [axesOf(a), axesOf(b)]
  const reach = (box: SheetBox, axes: [TablePoint, TablePoint], on: TablePoint) =>
    Math.abs(box.half.x * (axes[0].x * on.x + axes[0].y * on.y)) + Math.abs(box.half.y * (axes[1].x * on.x + axes[1].y * on.y))
  const apart = { x: b.at.x - a.at.x, y: b.at.y - a.at.y }
  return [...axesA, ...axesB].every((on) => Math.abs(apart.x * on.x + apart.y * on.y) < reach(a, axesA, on) + reach(b, axesB, on) - TOUCH)
}

/** The first other Frame that the Frame named meets, each with its margin; none while it is clear of all, or for a Frame
 * the Project lacks. What a refusal names (ticket 1222). */
export function frameMet(project: Layered, ref: FrameRef): FrameRef | undefined {
  if (framesOf(project).length < 2 || !frameById(project, ref)) return undefined
  const own = boxOf(project, ref)
  const met = framesOf(project).find((frame) => frameIdOf(frame) !== ref && boxesMeet(own, boxOf(project, frameIdOf(frame))))
  return met && frameIdOf(met)
}

/** A change of the Frame named stopped at the last place allowed (spec 1214): `step(k)` is the change `k` steps of
 * `steps` along, `step(steps)` the whole of it. The whole change where it meets no Frame; else the last step before
 * the first that meets one, or `before` itself. Frames that met already, as an older file may hold them, are let be. */
export function stoppedShort(before: Project, ref: FrameRef, steps: number, step: (k: number) => Project): Project {
  const whole = step(steps)
  if (!frameMet(whole, ref) || frameMet(before, ref)) return whole
  let last = before
  for (let k = 1; k < steps; k += 1) {
    const next = step(k)
    if (frameMet(next, ref)) return last
    last = next
  }
  return last
}

/** The angle a twist of the Frame named to `angle` stops at (spec 1214): the angle itself where the Frame turned to it
 * meets no other Frame, else the last whole degree from where it lies toward it, the short way round, before one it
 * meets. */
export function twistStop(project: Project, angle: number, ref: FrameRef): number {
  if (framesOf(project).length < 2 || !frameById(project, ref)) return angle
  const from = frameAngleOf(project, ref)
  const delta = ((normalizedOrientation(angle - from) + 180) % 360) - 180
  const steps = Math.ceil(Math.abs(delta))
  const at = (k: number) => (k === steps ? angle : normalizedOrientation(from + (delta * k) / steps))
  const stopped = stoppedShort(project, ref, steps, (k) => withFrameTurnedTo(project, at(k), ref))
  return stopped === project ? from : frameAngleOf(stopped, ref)
}
