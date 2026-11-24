import { footprintOf } from './footprint'
import { frameMet } from './frameSpacing'
import type { FrameRef } from './grid'
import { frameById, frameIdOf, framesOf, withFrameById } from './layerRecord'
import { canvasWeave } from './layerWeave'
import { MARGIN } from './margin'
import type { Project } from './project'
import { columnCycle, positionStep, rowCycle } from './weave'

// Where a new Frame lands when it has no place of its own (spec 1214, ticket 1222): a Starter's, put round the middle of
// the view. It goes to the nearest place clear of every other Frame's margin, and where none is near, to the right of the
// last Frame.

/** The Project with the Frame `ref` moved by `rows` and `columns`, whole Canvas positions. */
function shifted(project: Project, ref: FrameRef, rows: number, columns: number): Project {
  return withFrameById(project, ref, (held) => ({ ...held, row: held.row + rows, column: held.column + columns }))
}

/** `project`, whose Frame `ref` was just put where asked, with that Frame moved to the nearest place whole cycles of the
 * Canvas's rows and columns away that meets no other Frame (and its margin); to the right of the last Frame where none
 * lies within the reach of the Frames' sizes. The same Project where it is clear already. */
export function landedClear(project: Project, ref: FrameRef): Project {
  const placed = frameById(project, ref)
  if (!placed || !frameMet(project, ref)) return project
  const canvas = canvasWeave(project)
  const [down, across] = [rowCycle(canvas), columnCycle(canvas)]
  const step = positionStep(canvas)
  const others = framesOf(project).filter((frame) => frameIdOf(frame) !== ref)
  // Far enough to step clear of the biggest Frame, and its margin and the new Frame's, if only that one is in the way.
  const reach = Math.ceil(Math.max(...others.map((frame) => Math.max(frame.rows, frame.columns)), 0) / 2 + Math.max(placed.rows, placed.columns) / 2 + 2 * MARGIN)
  const near: { rows: number; columns: number; far: number }[] = []
  for (let rows = -Math.floor(reach / down) * down; rows <= reach; rows += down) {
    for (let columns = -Math.floor(reach / across) * across; columns <= reach; columns += across) {
      if (rows !== 0 || columns !== 0) near.push({ rows, columns, far: Math.hypot(rows * step.down, columns * step.across) })
    }
  }
  near.sort((a, b) => a.far - b.far)
  for (const { rows, columns } of near) {
    const moved = shifted(project, ref, rows, columns)
    if (!frameMet(moved, ref)) return moved
  }
  return rightOfLast(project, ref, others.map(frameIdOf), across, down)
}

/** The Frame to the right of the last other Frame, level with it, and further right until it is clear. */
function rightOfLast(project: Project, ref: FrameRef, others: readonly FrameRef[], across: number, down: number): Project {
  const placed = frameById(project, ref)!
  const last = footprintOf(project, others.at(-1)!)
  const right = Math.max(...others.flatMap((id) => footprintOf(project, id) ?? []).map((box) => box.column + box.columns), placed.column)
  const column = Math.ceil((right + 2 * MARGIN) / across) * across
  const row = last ? Math.round(last.row / down) * down : placed.row
  let moved = shifted(project, ref, row - placed.row, column - placed.column)
  for (let tries = 0; frameMet(moved, ref) && tries < 1000; tries += 1) moved = shifted(moved, ref, 0, across)
  return moved
}
