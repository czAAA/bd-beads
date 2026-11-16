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
function projectFrameSize(project: Project): string | undefined {
  const size = shownFrameSize(project)
  return size && `${size.width}×${size.height}`
}

/** The Frame's width and height in beads as the Project looks (the rotated view's swapped); none without a Frame. */
export function shownFrameSize(project: Project): { width: number; height: number } | undefined {
  if (!frameOf(project)) return undefined
  const { columns, rows } = shownDimensions(project)
  const [width, height] = rotationSwapsAxes(quarterTurnOf(project)) ? [rows, columns] : [columns, rows]
  return { width, height }
}

/** When a Project was last saved, for ordering the library and its rows' dates: its updatedAt when it predates savedAt (ticket 145). */
export function lastSaved(project: Pick<Project, 'savedAt' | 'updatedAt'>): number {
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

/** What other tabs changed in the stored library, by Project (ADR 0091): the records now different from what this tab
 * held, and the ids no longer there. */
export interface OutsideChange<T extends Entry> {
  changed: readonly T[]
  gone: readonly string[]
}

/** The library after taking in what other tabs stored, per Project: one changed here (`known` is what this tab last read
 * or wrote) stays this tab's unless `mayChange` refuses it; one removed here stays removed; one gone from storage is
 * removed here too, even when changed here after. Anything else takes the stored copy. */
export function takeInOutside<T extends Entry>(
  here: readonly T[],
  known: ReadonlyMap<string, T>,
  outside: OutsideChange<T>,
  mayChange: (id: string) => boolean = () => true,
): { library: T[]; known: Map<string, T> } {
  const gone = new Set(outside.gone)
  const stored = new Map(outside.changed.map((entry) => [entry.id, entry]))
  const hereIds = new Set(here.map((entry) => entry.id))
  const library: T[] = []
  for (const mine of here) {
    const theirs = stored.get(mine.id)
    if (gone.has(mine.id)) continue
    if (theirs === undefined) library.push(mine)
    else if (mine !== known.get(mine.id) && mayChange(mine.id)) library.push(mine)
    else library.push(theirs)
  }
  for (const theirs of outside.changed) {
    // A Project removed here stays removed (it is still `known`); one made elsewhere joins.
    if (!hereIds.has(theirs.id) && !known.has(theirs.id)) library.push(theirs)
  }
  const nextKnown = new Map(known)
  for (const id of gone) nextKnown.delete(id)
  for (const theirs of outside.changed) nextKnown.set(theirs.id, theirs)
  return { library, known: nextKnown }
}
