import { frameMet } from './frameSpacing'
import type { FrameRef } from './grid'
import { frameById, frameIdOf, framesOf } from './layerRecord'
import type { Project } from './project'
import { boxesMeet, frameBoxesOf, type SheetBox } from './sheets'
import { withFrameCentre } from './framePlacement'

// Where a new Frame lands when it has no place of its own (spec 1214, ticket 1222): a Starter's, put round the middle of
// the view. It goes to the nearest place clear of every other Frame's margin, and where none is near, to the right of the
// last Frame.

/** `project`, whose Frame `ref` was just put where asked, with that Frame moved to the nearest place on the Table that
 * meets no other Frame (and its margin); to the right of the last Frame where none lies within the reach of the Frames'
 * sizes. The same Project where it is clear already. */
export function landedClear(project: Project, ref: FrameRef): Project {
  const placed = frameById(project, ref)
  const own = frameBoxesOf(project, ref)
  if (!placed || !own || !frameMet(project, ref)) return project
  const others = framesOf(project).filter((frame) => frameIdOf(frame) !== ref)
  const sheets = others.map((frame) => frameBoxesOf(project, frameIdOf(frame))!.sheet)
  const [halfWidth, halfHeight] = [(own.sheet.right - own.sheet.left) / 2, (own.sheet.bottom - own.sheet.top) / 2]
  const at = placed.centre
  const lines = (from: number, half: number, edges: readonly [number, number][]) => [from, ...edges.flatMap(([low, high]) => [low - half, high + half])]
  const xs = lines(at.x, halfWidth, sheets.map((sheet) => [sheet.left, sheet.right]))
  const ys = lines(at.y, halfHeight, sheets.map((sheet) => [sheet.top, sheet.bottom]))
  const clear = (x: number, y: number) => {
    const box: SheetBox = { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight }
    return sheets.every((sheet) => !boxesMeet(box, sheet))
  }
  const found = xs.flatMap((x) => ys.filter((y) => clear(x, y)).map((y) => ({ x, y, far: Math.hypot(x - at.x, y - at.y) })))
  const nearest = found.reduce((best, each) => (each.far < best.far ? each : best), found[0]!)
  // Far enough to step clear of the biggest sheet where only that one is in the way.
  const reach = Math.max(...sheets.map((sheet) => Math.max(sheet.right - sheet.left, sheet.bottom - sheet.top))) + Math.max(halfWidth, halfHeight) * 2
  if (nearest.far <= reach) return withFrameCentre(project, { x: nearest.x, y: nearest.y }, ref)
  const last = frameBoxesOf(project, frameIdOf(others.at(-1)!))!
  const right = Math.max(...sheets.map((sheet) => sheet.right))
  return withFrameCentre(project, { x: right + halfWidth, y: (last.frame.top + last.frame.bottom) / 2 }, ref)
}
