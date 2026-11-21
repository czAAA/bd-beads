import type { FrameSheet } from './canvas'
import { carriedOffGrid } from './framePlacement'
import { laidFrameSheet } from './layerRecord'
import { touch, type FrameLayer, type Project } from './project'

// Laying the Frame's sheet (ADR 0066, 0079): apart from layerRecord, as a Frame off the Canvas's grid is carried to its
// place on the table by the placement's geometry (ticket 1188), which reads layers through layerRecord itself.

/** The Project with its Frame laid as a sheet (ADR 0066, 0079), or removed with none; a field left out is gone. A new one
 * (or `anew`) lies as the Canvas does by the sheet's quarter turns; a changed one keeps its own angle and off the grid
 * its place (ticket 1188, `carriedOffGrid`). Keeps its id, Bead, Letters and Row progress, the sheet's winning. */
export function withFrameSheet(project: Project, sheet: (FrameSheet & Partial<FrameLayer>) | undefined, laid: { anew?: boolean } = {}): Project {
  const next = laidFrameSheet(project, sheet, laid)
  return sheet && !laid.anew && project.layers[1]?.centre ? carriedOffGrid(project, next) : next
}

/** The Project with its Frame laid as a sheet, or removed with none, as `withFrameSheet` does, stamped as just-edited:
 * what a Frame edit commits. */
export function touchFrameSheet(project: Project, sheet: (FrameSheet & Partial<FrameLayer>) | undefined, laid: { anew?: boolean } = {}): Project {
  return touch(withFrameSheet(project, sheet, laid), {})
}
