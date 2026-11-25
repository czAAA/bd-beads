import type { Rect } from '../domain/canvas'
import type { FrameRef } from '../domain/grid'
import { frameById, heldWeave } from '../domain/layerRecord'
import { withFrameSheet } from '../domain/frameSheet'
import type { Project } from '../domain/project'
import { onCanvas } from './onCanvas'

/** The Project with its Frame laid over `rectangle`, Canvas positions (row, column, rows, columns), or removed with none: a test's
 * way of putting a Frame at a Canvas place now that a Frame holds a centre in mm (spec 1234). A Frame the Project has keeps its
 * beads and settings; one made anew is empty and woven as the Canvas is. */
export function withFrame(project: Project, rectangle: Rect | undefined, ref: FrameRef): Project {
  if (!rectangle) return withFrameSheet(project, undefined, { frame: ref })
  const current = frameById(project, ref)
  const base = current ? { ...current } : { beads: {}, ...heldWeave(project, 'canvas') }
  const { row, column, rows, columns } = rectangle
  const sheet = onCanvas(project, { ...base, centre: undefined, row, column, rows, columns })
  return withFrameSheet(project, sheet, { frame: ref, anew: !current })
}
