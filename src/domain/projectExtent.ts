import { beadBounds, frameDimensions, type Rect } from './canvas'
import type { GridDimensions } from './grid'
import type { Project } from './project'

// How far a Project reaches: its Frame, or the box round its beads when it has none, and that size in beads.

/** The Project's Frame, or for a Canvas without one the smallest box round its beads (nothing for an empty one). For
 * the parts of the app that still think in a Project's extent. */
export function projectFrame(project: Pick<Project, 'frame' | 'beads'>): Rect {
  return project.frame ?? beadBounds(project.beads) ?? { row: 0, column: 0, columns: 0, rows: 0 }
}

/** What the open Project's Frame measures in beads: what the person is told the size is, and what the rulers and the
 * printed pages number. */
export function projectDimensions(project: Pick<Project, 'frame' | 'beads'>): GridDimensions {
  return frameDimensions(projectFrame(project))
}
