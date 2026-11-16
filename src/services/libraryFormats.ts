import { inKnownTechniques, normalizeProject, type StoredProject } from '../domain/storedProject'
import type { Project } from '../domain/project'
import {
  decodeEarlierProject,
  decodeFlatProject,
  decodeProject,
  decodeVersionTwelveProject,
  encodeProject,
  type EncodedFlatProject,
  type EncodedGridProject,
  type EncodedProject,
  type EncodedVersionThreeProject,
} from '../domain/projectEncoding'
import { liftFlatWeave, renamedBrickBlock, type SavedProject } from '../domain/flatWeave'
import { projectSummaryOf, type ProjectSummary, type SealedProject } from '../domain/sealedProject'

// What the Project library is stored as, whichever device store holds it (ADR 0009, ADR 0094): the localStorage value's
// versions and their readers, a Project's stored JSON and what tells two writes of it apart. The stores (libraryStore,
// indexedLibraryStore) build on it.

/** The localStorage key of the old library, one value holding every Project (ADR 0001). */
export const STORAGE_KEY = 'openbeads:patterns'

// The stored format (ADR 0009): v1 a bare array of full hex cells, v2 compact grids, v3 compact beads by position, v4 (ADR
// 0066) the Frame's own beads, v5 (0664, ADR 0079) the layer list, v6 (0691) brick stitch's Drop under its new id. A record
// of the IndexedDB library holds one Project as version 6 writes it (ADR 0094).
export const STORED_VERSION = 6
/** The first version that stores the layer list, which a Project is kept sealed from (ticket 0716). */
export const LAYERED_VERSION = 5

export interface StoredLibrary {
  version: number
  // The key stays `patterns` in storage (ADR 0050).
  patterns: EncodedProject[]
}

/** The same envelope as version 4 wrote it, before the Project held its layers. */
interface StoredFlatLibrary {
  version: number
  patterns: EncodedFlatProject[]
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
// an array; a reader may throw on a wrong shape, which the callers treat like unparseable JSON.
export const READERS: Record<number, (parsed: unknown) => StoredProject[]> = {
  1: (parsed) => (parsed as SavedProject[]).map(liftFlatWeave),
  2: (parsed) => (parsed as StoredGridLibrary).patterns.map(decodeEarlierProject),
  3: (parsed) => (parsed as StoredVersionThreeLibrary).patterns.map(decodeEarlierProject),
  4: (parsed) => (parsed as StoredFlatLibrary).patterns.map(decodeFlatProject),
  5: (parsed) => (parsed as StoredLibrary).patterns.map(decodeVersionTwelveProject),
  6: (parsed) => (parsed as StoredLibrary).patterns.map(decodeProject),
}

/** Which stored format a parsed value is in, or undefined when it's neither a version-1 array nor a versioned
 * envelope. */
export function versionOf(parsed: unknown): number | undefined {
  if (Array.isArray(parsed)) {
    return 1
  }
  const version = (parsed as StoredLibrary | null)?.version
  return typeof version === 'number' ? version : undefined
}

/** A Project of the library as a tab holds it, decoded or sealed. A held Project carries its stamp: what the store
 * compares to tell whether another tab changed its record. */
export type HeldProject = Project | SealedProject

/** One Project as storage holds it: held already (opened or written by a tab here), or its stored JSON, not yet decoded. */
export type StoredRecord = HeldProject | string

/** Each Project's stored JSON, kept for that Project object (ticket 0677, as ADR 0080 keeps answers per bead map): a
 * Project is replaced whole on every change, so a save encodes only those that changed since the last one. */
const storedJson = new WeakMap<Project, string>()
const summaries = new WeakMap<Project, ProjectSummary | undefined>()

export function storedJsonOf(project: Project): string {
  let json = storedJson.get(project)
  if (json === undefined) {
    const encoded = encodeProject(project)
    json = JSON.stringify(encoded)
    storedJson.set(project, json)
    summaries.set(project, projectSummaryOf(encoded))
  }
  return json
}

/** Keeps `json` as the stored JSON of a Project decoded from it, so the next save of it is not an encoding. */
function keepStoredJson(project: Project, json: string): void {
  storedJson.set(project, json)
}

/** What a list needs to know of a held Project, without decoding: a sealed Project's own, a decoded Project's worked out
 * when it is encoded. */
export function summaryOf(project: HeldProject): ProjectSummary | undefined {
  if ('stored' in project) {
    const { stored: _stored, ...summary } = project
    return summary
  }
  const json = storedJsonOf(project)
  if (!summaries.has(project)) summaries.set(project, projectSummaryOf(JSON.parse(json)))
  return summaries.get(project)
}

/** The stamp of a Project in the localStorage library: its stored JSON. Another tab's write of it is a record with a
 * different one. */
export function stampOf(record: StoredRecord): string {
  if (typeof record === 'string') return record
  return 'stored' in record ? record.stored : storedJsonOf(record)
}

/** The records of a stored localStorage value, by Project, in stored order. Throws on a value this build can't read. */
export function parseRecords(raw: string): Map<string, StoredRecord> {
  const parsed: unknown = JSON.parse(raw)
  const version = versionOf(parsed)
  const read = version === undefined ? undefined : READERS[version]
  const records = new Map<string, StoredRecord>()
  if (!read) throw new Error('The stored library is in a form this build cannot read')
  if (version === STORED_VERSION || version === LAYERED_VERSION) {
    for (const encoded of inKnownTechniques((parsed as StoredLibrary).patterns)) {
      const current = version === STORED_VERSION ? encoded : { ...encoded, layers: encoded.layers.map(renamedBrickBlock) }
      records.set(encoded.id, JSON.stringify(current))
    }
  } else {
    for (const project of inKnownTechniques(read(parsed)).map(normalizeProject)) records.set(project.id, project)
  }
  return records
}

/** A stored record as a tab holds it: sealed when `keepSealed` picks it, otherwise decoded. */
export function heldFromRecord(record: StoredRecord, keepSealed: (summary: ProjectSummary) => boolean): HeldProject {
  const json = stampOf(record)
  const encoded = JSON.parse(json) as EncodedProject
  const summary = projectSummaryOf(encoded)
  if (summary && keepSealed(summary)) return { ...summary, stored: json }
  const project = normalizeProject(decodeProject(encoded))
  // Kept as stored, so the next stamp of it is this record's and it isn't taken for a change.
  keepStoredJson(project, json)
  return project
}

/** A sealed Project decoded, as a whole load would give it, its stored JSON kept as its encoding so the next save
 * doesn't encode it again (ticket 0716). */
export function unsealProject(sealed: SealedProject): Project {
  const project = normalizeProject(decodeProject(JSON.parse(sealed.stored) as EncodedProject))
  keepStoredJson(project, sealed.stored)
  return project
}

/** A Project the tab changed (or made) since its last save, for the store to write. */
export interface ProjectChange {
  project: HeldProject
  /** Whether the tab knew a record of it as stored: if that record is gone, another tab removed it, and it isn't written. */
  knownStored: boolean
}

/** What a save answers once it has landed. */
export interface SaveResult {
  /** The changed Projects not written because another tab removed them: the library drops them too. */
  dropped: readonly string[]
}

/** What changed in storage since the Projects a tab holds, by each one's stamp. */
export interface Reread {
  /** The records whose stamp differs from the held Project's, or that the tab doesn't hold, as the tab holds them. */
  changed: HeldProject[]
  /** The ids held that are no longer stored. */
  gone: string[]
}

/** Another tab's write: the Projects it names, or undefined when the store can't tell which (reread them all). */
export type OutsideChange = readonly string[] | undefined

/** What the start of the library answers: it opened, or the moved library can't be (ADR 0094). */
type LibraryStart = 'ready' | 'unopened'

// Where the Project library is kept (ADR 0020, spec 1018); useProjectLibrary persists through it, so tests fake it and a
// backend can add a store. Forms: the browser's IndexedDB (indexedLibraryStore), its localStorage (libraryStore, for a
// device that refuses IndexedDB) and, for tests and the Homepage's demo, memory (memoryLibraryStore).
export interface LibraryStore {
  /** Gets the library ready, before anything mounts. */
  start: () => Promise<LibraryStart>
  /** How many Projects are listed, without decoding any: the main address and the Homepage ask it before the start. */
  count: () => Promise<number | 'unopened'>
  /** Every stored Project, decoded, once the store has started. */
  load: () => Project[]
  /** The library with the Projects `keepSealed` picks left in their stored form (ticket 0716). Synchronous over what
   * the start loaded. */
  open: (keepSealed: (summary: ProjectSummary) => boolean) => { projects: Project[]; sealed: SealedProject[] }
  /** A sealed Project decoded, when it is picked. */
  unseal: (sealed: SealedProject) => Project
  /** Stores the Projects changed and removes the ids removed, and answers when it has landed; rejects when the device
   * refuses it. */
  save: (changed: readonly ProjectChange[], removed: readonly string[]) => Promise<SaveResult>
  /** The records that differ from the Projects `held` as the tab last read or wrote them. `ids` narrows it to the
   * Projects an outside change named. Rejects on a value this build can't read. */
  reread: (held: readonly HeldProject[], keepSealed: (summary: ProjectSummary) => boolean, ids?: readonly string[]) => Promise<Reread>
  /** Hears each time another tab stores; gives back the way to stop. */
  onOutsideChange: (listener: (named: OutsideChange) => void) => () => void
  /** The page is going: notes, synchronously, each write not yet landed for the next start (ADR 0012). */
  noteClosing: () => void
}
