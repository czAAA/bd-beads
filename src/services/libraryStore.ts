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
import { paletteFromDevice } from '../domain/palette'
import { liftFlatWeave, renamedBrickBlock, type SavedProject } from '../domain/flatWeave'
import { ADDED_COLORS_KEY, PALETTE_ORDER_KEY, readDeviceAddedColors, readDevicePaletteOrder } from './legacyDevicePalette'
import { readKey } from './storageKeys'
import { projectSummaryOf, type ProjectSummary, type SealedProject } from '../domain/sealedProject'

const STORAGE_KEY = 'openbeads:patterns'

// Where loadProjects keeps a value it can't read: a save writes the whole library (ADR 0012), so giving up and
// returning nothing would be one edit from overwriting a real library; a build predating a format can't read newer ones
// (ADR 0045), so keep the bytes.
const UNREADABLE_KEY = 'openbeads:patterns:unreadable'

// The stored format saveProjects writes (ADR 0009): v1 a bare array of Projects with full hex cells, v2 an envelope
// with compact grids, v3 compact beads by position, v4 (ADR 0066) the Frame's own beads, its settings a map (0636) or a
// flat Brick block, v5 (0664, ADR 0079) the layer list, v6 (0691) brick stitch's Drop under its new id.
const STORED_VERSION = 6
/** The first version that stores the layer list, which a Project is kept sealed from (ticket 0716). */
const LAYERED_VERSION = 5

interface StoredLibrary {
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
// an array; a reader may throw on a wrong shape, which loadProjects treats like unparseable JSON.
const READERS: Record<number, (parsed: unknown) => StoredProject[]> = {
  1: (parsed) => (parsed as SavedProject[]).map(liftFlatWeave),
  2: (parsed) => (parsed as StoredGridLibrary).patterns.map(decodeEarlierProject),
  3: (parsed) => (parsed as StoredVersionThreeLibrary).patterns.map(decodeEarlierProject),
  4: (parsed) => (parsed as StoredFlatLibrary).patterns.map(decodeFlatProject),
  5: (parsed) => (parsed as StoredLibrary).patterns.map(decodeVersionTwelveProject),
  6: (parsed) => (parsed as StoredLibrary).patterns.map(decodeProject),
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

/** Sets a stored value this build can't read aside, so a later save can't quietly replace it (see UNREADABLE_KEY). */
function keepUnreadable(raw: string): void {
  try {
    localStorage.setItem(UNREADABLE_KEY, raw)
  } catch {
    // No room for a second copy. Nothing better to do than carry on: the value is still under STORAGE_KEY for as long
    // as nothing overwrites it, and refusing to start the app over this would help no one.
  }
}

// TEMPORARY (ticket 0525): removed at the public release (ticket 0391). A Project stored before the Palette belonged to
// it is given the added colors and slot order this device kept, once: they are written into the library, and only then
// are the device keys removed.
function withDevicePalette(stored: StoredProject[], sealed: readonly SealedProject[]): StoredProject[] {
  const withoutPalette = stored.filter((project) => (project as Partial<Project>).palette === undefined)
  const added = readDeviceAddedColors(localStorage)
  const order = readDevicePaletteOrder(localStorage)
  if (withoutPalette.length === 0 || (added.length === 0 && order.length === 0)) return stored
  const palette = paletteFromDevice(added, order)
  const migrated = stored.map((project) => (withoutPalette.includes(project) ? { ...project, palette } : project))
  try {
    saveProjects(migrated.map(normalizeProject), sealed)
    localStorage.removeItem(ADDED_COLORS_KEY)
    localStorage.removeItem(PALETTE_ORDER_KEY)
  } catch {
    // No room to write: the device keys stay, and the next load tries again.
  }
  return migrated
}

/** The library as the editor opens it (ticket 0716): Projects decoded, and those kept sealed in their stored form. */
interface OpenedLibrary {
  projects: Project[]
  sealed: SealedProject[]
}

/** A Project of the library as a tab holds it, decoded or sealed. A held Project carries its stamp: what the store
 * compares to tell whether another tab changed its record (stampOf). */
export type HeldProject = Project | SealedProject

// Reads the whole library in any stored format (READERS). A current-format Project `keepSealed` picks stays stored (0716).
// Undefined for an unreadable value (bad JSON, wrong shape, newer version).
function readStored(raw: string, keepSealed: (summary: ProjectSummary) => boolean): OpenedLibrary | undefined {
  try {
    const parsed: unknown = JSON.parse(raw)
    const version = versionOf(parsed)
    const read = version === undefined ? undefined : READERS[version]
    if (read && (version === STORED_VERSION || version === LAYERED_VERSION)) {
      const sealed: SealedProject[] = []
      const decoded: EncodedProject[] = []
      // Version 5 differs only in brick stitch's Drop, stored as a Brick block: renamed here, the beads left encoded.
      const current = (stored: EncodedProject) => (version === STORED_VERSION ? stored : { ...stored, layers: stored.layers.map(renamedBrickBlock) })
      for (const encoded of inKnownTechniques((parsed as StoredLibrary).patterns).map(current)) {
        const summary = projectSummaryOf(encoded)
        if (summary && keepSealed(summary)) sealed.push({ ...summary, stored: JSON.stringify(encoded) })
        else decoded.push(encoded)
      }
      return { projects: withDevicePalette(decoded.map(decodeProject), sealed).map(normalizeProject), sealed }
    }
    if (read) {
      return { projects: withDevicePalette(inKnownTechniques(read(parsed)), []).map(normalizeProject), sealed: [] }
    }
  } catch {
    // Unparseable, or not the shape the version it claims implies — the same situation either way: unreadable here.
  }
  return undefined
}

/** One Project as storage holds it: held already (opened or written by a tab here), or its stored JSON, not yet decoded. */
type StoredRecord = HeldProject | string

/** What storage held when this page last read or wrote it, by Project. The raw value it came from makes it a plain
 * memo: a read that finds the same value parses nothing (tickets 0677, 0834). */
interface StoredLibraryView {
  raw: string | null
  records: Map<string, StoredRecord>
}

let seen: StoredLibraryView | undefined

/** The stamp of a Project: its stored JSON. Another tab's write of it is a record with a different one. Kept per Project
 * object (storedJsonOf), so a Project not changed is never encoded again. */
function stampOf(record: StoredRecord): string {
  if (typeof record === 'string') return record
  return 'stored' in record ? record.stored : storedJsonOf(record)
}

/** The records of a stored value, by Project, in stored order. Throws on a value this build can't read. */
function parseRecords(raw: string): Map<string, StoredRecord> {
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

/** What storage holds now by Project: what this page saw of that same value, or the value parsed once. */
function storedNow(): Map<string, StoredRecord> {
  const raw = readKey(localStorage, STORAGE_KEY)
  if (seen?.raw === raw) return seen.records
  const records = raw === null ? new Map<string, StoredRecord>() : parseRecords(raw)
  seen = { raw, records }
  return records
}

/** A stored record as a tab holds it: sealed when `keepSealed` picks it, otherwise decoded. */
function heldFromRecord(record: StoredRecord, keepSealed: (summary: ProjectSummary) => boolean): HeldProject {
  const json = stampOf(record)
  const encoded = JSON.parse(json) as EncodedProject
  const summary = projectSummaryOf(encoded)
  if (summary && keepSealed(summary)) return { ...summary, stored: json }
  const project = normalizeProject(decodeProject(encoded))
  // Kept as stored, so the next stamp of it is this record's and it isn't taken for a change.
  storedJson.set(project, json)
  return project
}

// The library as it opens (see readStored). For an unreadable value (bad JSON, wrong shape, newer version) returns no
// Projects, after keeping the bytes aside.
function openStored(keepSealed: (summary: ProjectSummary) => boolean): OpenedLibrary {
  const raw = readKey(localStorage, STORAGE_KEY)
  const opened = raw === null ? { projects: [], sealed: [] } : readStored(raw, keepSealed)
  if (raw !== null && !opened) keepUnreadable(raw)
  const library = opened ?? { projects: [], sealed: [] }
  // Read again: opening may have moved the device's old Palette into the library (withDevicePalette).
  seen = { raw: readKey(localStorage, STORAGE_KEY), records: new Map([...library.projects, ...library.sealed].map((project) => [project.id, project])) }
  return library
}

/** Every stored Project, decoded (see openStored). @internal Tests read back what the app saved with it. */
export function loadProjects(): Project[] {
  return openStored(() => false).projects
}

/** How many Projects are stored, read without decoding any (ticket 0716): the main address decides between the
 * Homepage and the editor on it, and the Homepage names it. An unreadable value counts none. */
function storedProjectCount(): number {
  try {
    const raw = readKey(localStorage, STORAGE_KEY)
    if (raw === null) return 0
    const parsed: unknown = JSON.parse(raw)
    const patterns = Array.isArray(parsed) ? parsed : (parsed as StoredLibrary | null)?.patterns
    return Array.isArray(patterns) ? inKnownTechniques(patterns).length : 0
  } catch {
    return 0
  }
}

/** Each Project's stored JSON, kept for that Project object (ticket 0677, as ADR 0080 keeps answers per bead map): a
 * Project is replaced whole on every change, so a save encodes only those that changed since the last one. */
const storedJson = new WeakMap<Project, string>()

function storedJsonOf(project: Project): string {
  let json = storedJson.get(project)
  if (json === undefined) {
    json = JSON.stringify(encodeProject(project))
    storedJson.set(project, json)
  }
  return json
}

/** Writes the library from `records` (ADR 0009), each Project from its kept encoding or its stored JSON (tickets 0677,
 * 0716), and remembers it as what storage holds. Throws the browser's QuotaExceededError when it doesn't fit; the
 * caller surfaces it. */
function writeRecords(records: Map<string, StoredRecord>): void {
  const raw = `{"version":${STORED_VERSION},"patterns":[${[...records.values()].map(stampOf).join(',')}]}`
  localStorage.setItem(STORAGE_KEY, raw)
  seen = { raw, records }
}

/** Replaces the whole stored library with these Projects.
 * @internal Tests seed a library with it before mounting the App. */
export function saveProjects(projects: Project[], sealed: readonly SealedProject[] = []): void {
  writeRecords(new Map([...projects, ...sealed].map((project) => [project.id, project])))
}

/** A sealed Project decoded, as a whole load would give it, its stored JSON kept as its encoding so the next save
 * doesn't encode it again (ticket 0716). */
function unsealProject(sealed: SealedProject): Project {
  const project = normalizeProject(decodeProject(JSON.parse(sealed.stored) as EncodedProject))
  storedJson.set(project, sealed.stored)
  return project
}

/** A Project the tab changed (or made) since its last save, for the store to write. */
export interface ProjectChange {
  project: HeldProject
  /** Whether the tab knew a record of it as stored: if that record is gone, another tab removed it, and it isn't written. */
  knownStored: boolean
}

/** What a save answers once it has landed. */
interface SaveResult {
  /** The changed Projects not written because another tab removed them: the library drops them too. */
  dropped: readonly string[]
}

/** What changed in storage since the Projects a tab holds, by each one's stamp. */
interface Reread {
  /** The records whose stamp differs from the held Project's, or that the tab doesn't hold, as the tab holds them. */
  changed: HeldProject[]
  /** The ids held that are no longer stored. */
  gone: string[]
}

/** Another tab's write: the Projects it names, or undefined when the store can't tell which (reread them all). */
export type OutsideChange = readonly string[] | undefined

// Where the Project library is kept (ADR 0020, spec 1018); useProjectLibrary persists through it, so tests fake it and a
// backend can add a store. Forms: the browser's localStorage (below) and, for tests and the Homepage's demo, memory
// (memoryLibraryStore). A device that refuses the start or can't open the library is ticket 1020's.
export interface LibraryStore {
  /** Gets the library ready, before anything mounts. */
  start: () => Promise<'ready'>
  /** How many Projects are listed, without decoding any: the main address and the Homepage ask it before the start. */
  count: () => Promise<number>
  /** Every stored Project, decoded, once the store has started. */
  load: () => Project[]
  /** The library with the Projects `keepSealed` picks left in their stored form (ticket 0716). Synchronous over what
   * the start loaded. */
  open: (keepSealed: (summary: ProjectSummary) => boolean) => OpenedLibrary
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
}

/** How long to wait for a quiet moment where the browser has no idle callback (Safari). */
const IDLE_FALLBACK_MS = 200

function whenIdle(work: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(work)
  else setTimeout(work, IDLE_FALLBACK_MS)
}

/** Keeps the encoding of each Project of a library just opened, one per idle moment (ticket 0677): otherwise the first
 * save after opening would encode them all. */
function encodeWhenIdle(projects: readonly Project[]): void {
  const waiting = [...projects]
  const next = (): void => {
    const project = waiting.shift()
    if (!project) return
    storedJsonOf(project)
    whenIdle(next)
  }
  whenIdle(next)
}

/** The library in this browser's localStorage (ADR 0001): the whole library is one value, so every write goes inside the
 * save call (the flush on pagehide keeps its guarantee) and only its answer comes later. */
export const browserLibraryStore: LibraryStore = {
  start: () => Promise.resolve('ready'),
  count: () => Promise.resolve(storedProjectCount()),
  load: () => {
    const projects = loadProjects()
    encodeWhenIdle(projects)
    return projects
  },
  open: (keepSealed) => {
    const opened = openStored(keepSealed)
    encodeWhenIdle(opened.projects)
    return opened
  },
  unseal: unsealProject,
  save: (changed, removed) => {
    try {
      const stored = storedNow()
      const dropped: string[] = []
      const next = new Map<string, StoredRecord>()
      for (const { project, knownStored } of changed) {
        if (knownStored && !stored.has(project.id)) dropped.push(project.id)
        else next.set(project.id, project)
      }
      const removedHere = new Set(removed)
      for (const [id, record] of stored) if (!next.has(id) && !removedHere.has(id)) next.set(id, record)
      writeRecords(next)
      return Promise.resolve({ dropped })
    } catch (error) {
      return Promise.reject(error)
    }
  },
  reread: (held, keepSealed) => {
    try {
      const stored = storedNow()
      const stamps = new Map(held.map((project) => [project.id, stampOf(project)]))
      const changed: HeldProject[] = []
      for (const [id, record] of stored) if (stamps.get(id) !== stampOf(record)) changed.push(heldFromRecord(record, keepSealed))
      return Promise.resolve({ changed, gone: [...stamps.keys()].filter((id) => !stored.has(id)) })
    } catch (error) {
      return Promise.reject(error)
    }
  },
  // The browser tells every other tab of the origin about a write, never the one that wrote it; a cleared storage has
  // no key. It doesn't say which Projects.
  onOutsideChange: (listener) => {
    const heard = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) listener(undefined)
    }
    window.addEventListener('storage', heard)
    return () => window.removeEventListener('storage', heard)
  },
}
