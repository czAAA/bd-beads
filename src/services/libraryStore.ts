import { beadLabel, findBead } from '../domain/beads'
import { normalizeProject, type GridProject, type Project } from '../domain/project'
import { decodeProject, encodeProject, type EncodedGridProject, type EncodedProject } from '../domain/projectEncoding'

const STORAGE_KEY = 'bd-beads:patterns'

/**
 * Where loadProjects keeps a stored value it can't read, rather than leaving it to be overwritten. A save always writes
 * the whole library from memory (ADR 0012), so a read that gives up and returns nothing is otherwise one edit away from
 * replacing a real library with an empty one. That only became reachable once the format had versions at all — a build
 * predating a format can't read what a newer one wrote (this app is served from a cache, ADR 0003) — so the bytes are
 * kept aside for whichever build does understand them.
 */
const UNREADABLE_KEY = 'bd-beads:patterns:unreadable'

/**
 * The stored format saveProjects writes (ADR 0009). Version 1 is the original: a bare JSON array of Projects, each
 * carrying an object per cell with a full hex string in it. Version 2 wraps the library in this envelope and stores
 * every grid compactly (see projectEncoding).
 *
 * Nothing but loadProjects and saveProjects ever sees either shape — the rest of the app works with plain Projects.
 */
const STORED_VERSION = 3

interface StoredLibrary {
  version: number
  // The key stays `patterns` in storage (ADR 0028).
  patterns: EncodedProject[]
}

/** The same envelope as version 2 wrote it: every Project a fixed grid of cells, before the open canvas (ADR 0026). */
interface StoredGridLibrary {
  version: number
  patterns: EncodedGridProject[]
}

/**
 * Every stored format this build can read, keyed by version: each takes the parsed JSON and hands back plain Projects.
 * A third format needs only another entry here — version 1 is the one shape that has to be recognised by its own
 * outline (an array, not an envelope), and everything since says which version it is.
 *
 * A reader may throw on a value that isn't the shape it claims to be; loadProjects treats that the same as unparseable
 * JSON.
 */
const READERS: Record<number, (parsed: unknown) => (Project | GridProject)[]> = {
  1: (parsed) => parsed as GridProject[],
  2: (parsed) => (parsed as StoredGridLibrary).patterns.map(decodeProject),
  3: (parsed) => (parsed as StoredLibrary).patterns.map(decodeProject),
}

/** Which stored format a parsed value is in, or undefined when it's neither a version-1 array nor a versioned envelope. */
function versionOf(parsed: unknown): number | undefined {
  if (Array.isArray(parsed)) {
    return 1
  }
  const version = (parsed as StoredLibrary | null)?.version
  return typeof version === 'number' ? version : undefined
}

/** Projects saved before the `name` field existed have none; fall back to the bead label. */
function withName<T extends Project | GridProject>(project: T): T {
  if (project.name) {
    return project
  }
  const bead = findBead(project.beadId)
  return { ...project, name: bead ? beadLabel(bead) : project.beadId }
}

/** Sets a stored value this build can't read aside, so a later save can't quietly replace it (see UNREADABLE_KEY). */
function keepUnreadable(raw: string): void {
  try {
    localStorage.setItem(UNREADABLE_KEY, raw)
  } catch {
    // No room for a second copy. Nothing better to do than carry on: the value is still under STORAGE_KEY for as long
    // as nothing overwrites it, and refusing to start the app over this would help no one.
  }
}

/**
 * Reads the whole Project library, in whichever stored format wrote it (see READERS). A library still in an older
 * format decodes to exactly the Projects it held; the next save rewrites it in the current one, since saveProjects
 * always writes the whole library.
 *
 * Returns no Projects at all — rather than throwing — for a value this build can't read: unparseable JSON, a shape that
 * doesn't match the version it claims, or a version a newer build wrote. That value is kept aside first, because the
 * app carrying on from an empty library is only safe if the bytes it couldn't read survive it (see UNREADABLE_KEY).
 */
export function loadProjects(): Project[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    const version = versionOf(parsed)
    const read = version === undefined ? undefined : READERS[version]
    if (read) {
      return read(parsed).map(withName).map(normalizeProject)
    }
  } catch {
    // Unparseable, or not the shape the version it claims implies — the same situation either way: unreadable here.
  }

  keepUnreadable(raw)
  return []
}

/**
 * Writes the whole Project library, replacing whatever was there. The caller's in-memory library is the source of
 * truth (see useProjectLibrary), so this deliberately doesn't read storage back first to merge: a save used to parse
 * and re-normalise every saved Project before writing a single changed one, which is most of what ticket 55 measured
 * on the per-cell paint path.
 *
 * Every grid is encoded compactly on the way out (ADR 0009), which is the whole of the format change: an ordinary
 * 60×90 Project costs about 3KB here instead of about 100KB.
 *
 * Throws whatever the browser throws when the write doesn't fit (a QuotaExceededError, typically) — the caller is
 * expected to catch that and surface it rather than lose the edit silently.
 */
export function saveProjects(projects: Project[]): void {
  const stored: StoredLibrary = { version: STORED_VERSION, patterns: projects.map(encodeProject) }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

/**
 * Where the Project library is kept (ADR 0020). useProjectLibrary persists through this, so its tests hand it a fake
 * and the backend phase can add a store that syncs beside this one.
 */
export interface LibraryStore {
  /** Every stored Project; see loadProjects for what an unreadable value gives. */
  load: () => Project[]
  /** Replaces the stored library; throws when the device refuses the write (see saveProjects). */
  save: (projects: Project[]) => void
}

/** The library in this browser's localStorage (ADR 0001). */
export const browserLibraryStore: LibraryStore = { load: loadProjects, save: saveProjects }
