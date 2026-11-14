import { rotationSwapsAxes } from './grid'
import type { Project } from './project'
import { shownDimensions } from './projectExtent'
import { frameOf, quarterTurnOf, projectNameOf } from './layerRecord'

// The Project library's lists (ticket 145): a Project's line in them and their order.

/** A short, language-neutral identifier for a Project in UI lists (names are proper nouns, not translated): its name
 * and, once it has a Frame, the Frame's size; reflects the rotated view's swapped dimensions, since that's how the
 * Project currently looks. */
export function summarizeProject(project: Project): string {
  const size = projectFrameSize(project)
  return size ? `${projectNameOf(project)} · ${size}` : projectNameOf(project)
}

/** The Frame's size as the Project looks, "24×14"; none without a Frame: a canvas with none has no size to state (ADR 0026). */
export function projectFrameSize(project: Project): string | undefined {
  if (!frameOf(project)) return undefined
  const { columns, rows } = shownDimensions(project)
  const [width, height] = rotationSwapsAxes(quarterTurnOf(project)) ? [rows, columns] : [columns, rows]
  return `${width}×${height}`
}

/** When a Project was last saved, for ordering the library: its updatedAt when it predates savedAt (ticket 145). */
function lastSaved(project: Pick<Project, 'savedAt' | 'updatedAt'>): number {
  return project.savedAt ?? project.updatedAt
}

/** Stamps a Project as saved just now: the library's front (ticket 145). */
export function markSaved(project: Project, at = Date.now()): Project {
  return { ...project, savedAt: at }
}

/** The Project library's order (ticket 145): newest saved first; ties, most recently edited first; otherwise as they
 * were, so a library read twice comes out the same. Sealed Projects (ticket 0716) are ordered alike. */
export function inSavedOrder<T extends Pick<Project, 'savedAt' | 'updatedAt'>>(projects: T[]): T[] {
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

/** One Project of the library as the merge reads it: decoded or sealed, told apart by nothing but its id. */
interface Entry {
  id: string
}

/** The library a save writes when another tab may have stored since (ticket 0834): `stored` with this tab's changes
 * since `known` (what it last read or wrote) on top, so what another tab made, renamed or removed stays so, and one
 * changed here but removed there stays removed. `mayChange` is false for a Project another tab has open first. */
export function mergeLibrary<T extends Entry>(
  here: readonly T[],
  known: ReadonlyMap<string, T>,
  stored: readonly T[],
  mayChange: (id: string) => boolean = () => true,
): T[] {
  const hereById = new Map(here.map((entry) => [entry.id, entry]))
  const storedIds = new Set(stored.map((entry) => entry.id))
  const changedHere = (id: string) => {
    const mine = hereById.get(id)
    return mine === undefined ? known.has(id) : mine !== known.get(id) && mayChange(id)
  }
  const merged: T[] = []
  for (const entry of stored) {
    if (!changedHere(entry.id)) merged.push(entry)
    else if (hereById.has(entry.id)) merged.push(hereById.get(entry.id)!)
  }
  for (const entry of here) {
    if (!storedIds.has(entry.id) && !known.has(entry.id)) merged.push(entry)
  }
  return merged
}
