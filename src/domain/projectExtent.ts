import { beadBounds, frameDimensions, type Rect } from './canvas'
import { laidRect, seenSize } from './frameOrientation'
import type { GridDimensions } from './grid'
import type { Project } from './project'
import { projectCell, type ShapedBead } from './projectBead'

// How far a Project reaches: its Frame, or the box round its beads when it has none, and that size in beads.

/** The Project's Frame as it lies on the Canvas (turned, ticket 0667), or for a Canvas without one the smallest box
 * round its beads (nothing for an empty one). For the parts of the app that still think in a Project's extent. */
export function projectFrame(project: Pick<Project, 'frame' | 'beads'> & ShapedBead): Rect {
  const frame = project.frame
  if (frame) return laidRect({ ...frame, ...(frame.quarterTurns ? { cell: projectCell(project) } : {}) })
  return beadBounds(project.beads) ?? { row: 0, column: 0, columns: 0, rows: 0 }
}

/** What the open Project's Frame measures in beads as it lies: what the person is told the size is, and what the
 * rulers and the printed pages number. */
export function projectDimensions(project: Pick<Project, 'frame' | 'beads'> & ShapedBead): GridDimensions {
  return frameDimensions(projectFrame(project))
}

/** What the Project measures in beads as the person is told it: its Frame's Width and Height as seen (a turned plain
 * Frame's own swapped, ticket 0667), or the box round its beads. */
export function shownDimensions(project: Pick<Project, 'frame' | 'beads'>): GridDimensions {
  return project.frame ? seenSize(project.frame) : projectDimensions(project)
}
