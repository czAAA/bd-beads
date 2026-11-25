import type { FrameSheet } from './canvas'
import { laidFrameSheet } from './layerRecord'
import type { FrameRef } from './grid'
import { touch, type FrameLayer, type Project } from './project'

// Laying the Frame's sheet (ADR 0066, 0079).

/** The Project with its Frame laid as a sheet (ADR 0066, 0079), or removed with none; a field left out is gone. A new one
 * (or `anew`) lies as the Canvas does by the sheet's quarter turns; a changed one keeps its own angle and, unless the sheet
 * gives another, its centre on the Table (spec 1234). Keeps its id, Bead, Letters and Row progress, the sheet's winning. */
export function withFrameSheet(project: Project, sheet: (FrameSheet & Partial<FrameLayer>) | undefined, laid: { anew?: boolean; frame: FrameRef }): Project {
  return laidFrameSheet(project, sheet, { anew: laid.anew, frame: laid.frame })
}

/** The Project with its Frame laid as a sheet, or removed with none, as `withFrameSheet` does, stamped as just-edited:
 * what a Frame edit commits. */
export function touchFrameSheet(project: Project, sheet: (FrameSheet & Partial<FrameLayer>) | undefined, laid: { anew?: boolean; frame: FrameRef }): Project {
  return touch(withFrameSheet(project, sheet, laid), {})
}
