import type { FrameRef } from './grid'
import { frameIdOf, framesOf, type Layered } from './layerRecord'
import { boxesMeet, frameBoxesOf } from './sheets'
import type { Project } from './project'
import type { TablePoint } from './table'

// Frames never meet (spec 1214, ticket 1218; spec 1234): a Frame plus its keep-out margin never touches another Frame plus
// its margin. Each sheet is a rectangle on the Table in mm, so the rule holds wherever the Frames lie.

/** The first other Frame that the Frame named meets, each with its margin; none while it is clear of all, or for a Frame
 * the Project lacks. What a refusal names (ticket 1222). */
export function frameMet(project: Layered, ref: FrameRef): FrameRef | undefined {
  const own = frameBoxesOf(project, ref)
  if (!own || framesOf(project).length < 2) return undefined
  const met = framesOf(project).find((frame) => frameIdOf(frame) !== ref && boxesMeet(own.sheet, frameBoxesOf(project, frameIdOf(frame))!.sheet))
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

/** How far of a move of the Frame named by `delta` on the Table, in mm, it may go: the whole of it where its sheet meets
 * no other along the way, else as far as it touches the first sheet in its path. Frames that met already are let be. */
export function stoppedMoveAt(project: Project, ref: FrameRef, delta: TablePoint): TablePoint {
  const own = frameBoxesOf(project, ref)
  if (!own || framesOf(project).length < 2 || frameMet(project, ref)) return delta
  let first = 1
  for (const frame of framesOf(project)) {
    if (frameIdOf(frame) === ref) continue
    const other = frameBoxesOf(project, frameIdOf(frame))!.sheet
    // The times, as shares of the move, at which the sheets overlap along each axis: where both do, they meet.
    const along = (low: number, high: number, from: number, to: number, by: number): [number, number] => {
      if (by === 0) return from < high && low < to ? [-Infinity, Infinity] : [Infinity, -Infinity]
      const [a, b] = [(low - to) / by, (high - from) / by]
      return a < b ? [a, b] : [b, a]
    }
    const [x, y] = [along(other.left, other.right, own.sheet.left, own.sheet.right, delta.x), along(other.top, other.bottom, own.sheet.top, own.sheet.bottom, delta.y)]
    const [enter, leave] = [Math.max(x[0], y[0]), Math.min(x[1], y[1])]
    if (enter < leave && enter > 0 && enter < first) first = enter
  }
  return { x: delta.x * first, y: delta.y * first }
}
