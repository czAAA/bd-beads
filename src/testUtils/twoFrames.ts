import { createProject } from '../domain/createProject'
import { withFrameSheet } from '../domain/frameSheet'
import type { FrameId, GridPosition } from '../domain/grid'
import { frameIdOf, framesOf } from '../domain/layerRecord'
import { onCanvas } from './onCanvas'
import type { Project } from '../domain/project'
import { frameIdIn } from './frameId'

/** The second Frame's id in a `twoFrames` Project. */
export const SECOND = frameIdOf({ id: 'second' })

/** A loom Project with two Frames (ticket 1218), what the app cannot make yet: the first 6 rows by 4 columns at 0, 0
 * (its margin rows -4 to 9, columns -4 to 7), the second, `SECOND`, at `at` (20, 20 by default: its margin rows 16 to
 * 29, columns 16 to 27), 6 by 4 unless sized. */
export function twoFrames(at: GridPosition = { row: 20, column: 20 }, second = { rows: 6, columns: 4 }): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  const first = withFrameSheet(base, onCanvas(base, { row: 0, column: 0, rows: 6, columns: 4, beads: {}, technique: 'loom' }), { frame: frameIdIn(base) })
  return withFrameSheet(first, onCanvas(first, { ...at, ...second, beads: {}, technique: 'loom' }), { frame: SECOND })
}

/** The first Frame's id in a Project. */
export const firstOf = (project: Project): FrameId => frameIdOf(framesOf(project)[0]!)
