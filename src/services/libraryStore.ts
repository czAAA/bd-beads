import { beadLabel, findBead } from '../domain/beads'
import { normalizeProject, type Project, type StoredProject } from '../domain/project'
import {
  decodeEarlierProject,
  decodeProject,
  encodeProject,
  type EncodedGridProject,
  type EncodedProject,
  type EncodedVersionThreeProject,
} from '../domain/projectEncoding'
import { readKey } from './storageKeys'

const STORAGE_KEY = 'openbeads:patterns'

// Where loadProjects keeps a value it can't read: a save writes the whole library (ADR 0012), so giving up and
// returning nothing would be one edit from overwriting a real library; a build predating a format can't read newer ones
// (ADR 0045), so keep the bytes.
const UNREADABLE_KEY = 'openbeads:patterns:unreadable'

// The stored format saveProjects writes (ADR 0009): v1 a bare array of Projects with full hex cells, v2 an envelope
// with compact grids, v3 compact beads by position, v4 (ADR 0066) the Frame with its own beads.
const STORED_VERSION = 4

interface StoredLibrary {
  version: number
  // The key stays `patterns` in storage (ADR 0028).
  patterns: EncodedProject[]
}

/** The same envelope as version 3 wrote it, before the Frame had beads of its own (temporary, see versionThree.ts). */
interface StoredVersionThreeLibrary {
  version: number
  patterns: EncodedVersionThreeProject[]
}

/** The same envelope as version 2 wrote it: every Project a fixed grid of cells, before the Canvas (ADR 0026). */
interface StoredGridLibrary {
  version: number
  patterns: EncodedGridProject[]
}

// Every readable stored format by version: each takes parsed JSON and returns plain Projects. v1 is recognised by being
// an array; a reader may throw on a wrong shape, which loadProjects treats like unparseable JSON.
const READERS: Record<number, (parsed: unknown) => StoredProject[]> = {
  1: (parsed) => parsed as StoredProject[],
  2: (parsed) => (parsed as StoredGridLibrary).patterns.map(decodeEarlierProject),
  3: (parsed) => (parsed as StoredVersionThreeLibrary).patterns.map(decodeEarlierProject),
  4: (parsed) => (parsed as StoredLibrary).patterns.map(decodeProject),
}

/** Which stored format a parsed value is in, or undefined when it's neither a version-1 array nor a versioned
 * envelope. */
function versionOf(parsed: unknown): number | undefined {
  if (Array.isArray(parsed)) {
    return 1
  }
  const version = (parsed as StoredLibrary | null)?.version
  return typeof version === 'number' ? version : undefined
}

/** Projects saved before the `name` field existed have none; fall back to the bead label. */
function withName<T extends StoredProject>(project: T): T {
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

// Reads the whole library in any stored format (see READERS); the next save rewrites it in the current one. For an
// unreadable value (bad JSON, wrong shape, newer version) returns no Projects, after keeping the bytes aside (see
// UNREADABLE_KEY) so they survive.
export function loadProjects(): Project[] {
  const raw = readKey(localStorage, STORAGE_KEY)
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

// Writes the whole library, replacing what was there; the in-memory library is the truth (useProjectLibrary), so no
// read-back merge (ticket 55). Grids are encoded compactly (ADR 0009): a 60×90 Project is about 3KB, not 100KB. Throws
// what the browser throws when the write doesn't fit (QuotaExceededError); the caller must surface it.
export function saveProjects(projects: Project[]): void {
  const stored: StoredLibrary = { version: STORED_VERSION, patterns: projects.map(encodeProject) }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

// Where the Project library is kept (ADR 0020); useProjectLibrary persists through it, so tests fake it and a backend
// can add a store.
export interface LibraryStore {
  /** Every stored Project; see loadProjects for what an unreadable value gives. */
  load: () => Project[]
  /** Replaces the stored library; throws when the device refuses the write (see saveProjects). */
  save: (projects: Project[]) => void
}

/** The library in this browser's localStorage (ADR 0001). */
export const browserLibraryStore: LibraryStore = { load: loadProjects, save: saveProjects }
