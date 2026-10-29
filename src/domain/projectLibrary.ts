import { rotationSwapsAxes } from './grid'
import type { Project } from './project'
import { shownDimensions } from './projectExtent'

// The Project library's lists (ticket 145): a Project's line in them and their order.

/** A short, language-neutral identifier for a Project in UI lists (names are proper nouns, not translated): its name
 * and, once it has a Frame, the Frame's size; reflects the rotated view's swapped dimensions, since that's how the
 * Project currently looks. */
export function summarizeProject(project: Project): string {
  // The size is the Frame's: a canvas with none has no size to state (ADR 0026).
  if (!project.frame) {
    return project.name
  }
  const { columns, rows } = shownDimensions(project)
  const [width, height] = rotationSwapsAxes(project.rotation) ? [rows, columns] : [columns, rows]
  return `${project.name} · ${width}×${height}`
}

/** When a Project was last saved, for ordering the library: its updatedAt when it predates savedAt (ticket 145). */
function lastSaved(project: Project): number {
  return project.savedAt ?? project.updatedAt
}

/** Stamps a Project as saved just now: the library's front (ticket 145). */
export function markSaved(project: Project, at = Date.now()): Project {
  return { ...project, savedAt: at }
}

/** The Project library's order (ticket 145): newest saved first; ties, most recently edited first; otherwise as they
 * were, so a library read twice comes out the same. */
export function inSavedOrder(projects: Project[]): Project[] {
  return projects
    .map((project, index) => ({ project, index }))
    .sort((a, b) => lastSaved(b.project) - lastSaved(a.project) || b.project.updatedAt - a.project.updatedAt || a.index - b.index)
    .map(({ project }) => project)
}

/** The Project edited last, or none in an empty list: the one the library opens at start, after a removal or from an import. */
export function mostRecentlyUpdated(projects: Project[]): Project | undefined {
  return projects.reduce<Project | undefined>(
    (latest, project) => (!latest || project.updatedAt > latest.updatedAt ? project : latest),
    undefined,
  )
}
