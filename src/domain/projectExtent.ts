import { beadBounds, frameDimensions, type Rect } from './canvas'
import type { GridDimensions } from './grid'
import { frameWeave } from './layerWeave'
import type { Project } from './project'
import { describeWeave } from './weave'

// How far a Project reaches: its Frame, or the box round its beads when it has none, and that size in counted units.

/** The Project's Frame, or for a Canvas without one the smallest box round its beads (nothing for an empty one). For
 * the parts of the app that still think in a Project's extent. */
export function projectFrame(project: Pick<Project, 'frame' | 'beads'>): Rect {
  return project.frame ?? beadBounds(project.beads) ?? { row: 0, column: 0, columns: 0, rows: 0 }
}

/** What the open Project's Frame measures in beads, for the grid-shaped helpers (adjacency, fit
 * zoom). */
export function projectDimensions(project: Pick<Project, 'frame' | 'beads'>): GridDimensions {
  return frameDimensions(projectFrame(project))
}

/** What the Frame measures in what the Technique counts (ticket 482): beads, or Units where it counts them. What the
 * person is told the size is, and what the rulers and the printed pages number. */
export function countedDimensions(project: Pick<Project, 'frame' | 'beads' | 'technique' | 'techniqueSettings'>): GridDimensions {
  return describeWeave(frameWeave(project)).unitsOf(projectDimensions(project))
}
