import { inKnownTechniques, normalizeProject, type StoredProject } from '../domain/storedProject'
import type { Project } from '../domain/project'
import { decodeProject, type EncodedProject } from '../domain/projectEncoding'
import { paletteFromDevice } from '../domain/palette'
import { renamedBrickBlock } from '../domain/flatWeave'
import { MOVED_FLAG, copyOldLibrary, indexedLibraryStore, libraryConnection, openLibraryDatabase, replayClosingNote, type LibraryConnection } from './indexedLibraryStore'
import { ADDED_COLORS_KEY, PALETTE_ORDER_KEY, readDeviceAddedColors, readDevicePaletteOrder } from './legacyDevicePalette'
import { readKey } from './storageKeys'
import { projectSummaryOf, type ProjectSummary, type SealedProject } from '../domain/sealedProject'
import {
  LAYERED_VERSION,
  READERS,
  STORAGE_KEY,
  STORED_VERSION,
  heldFromRecord,
  parseRecords,
  stampOf,
  storedJsonOf,
  unsealProject,
  versionOf,
  type HeldProject,
  type LibraryStore,
  type StoredLibrary,
  type StoredRecord,
} from './libraryFormats'

export type { HeldProject, LibraryStore, OutsideChange, ProjectChange } from './libraryFormats'

// Where loadProjects keeps a value it can't read: a save writes the whole library (ADR 0012), so giving up and
// returning nothing would be one edit from overwriting a real library; a build predating a format can't read newer ones
// (ADR 0045), so keep the bytes.
const UNREADABLE_KEY = 'openbeads:patterns:unreadable'

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

/** What storage held when this page last read or wrote it, by Project. The raw value it came from makes it a plain
 * memo: a read that finds the same value parses nothing (tickets 0677, 0834). */
interface StoredLibraryView {
  raw: string | null
  records: Map<string, StoredRecord>
}

let seen: StoredLibraryView | undefined

/** What storage holds now by Project: what this page saw of that same value, or the value parsed once. */
function storedNow(): Map<string, StoredRecord> {
  const raw = readKey(localStorage, STORAGE_KEY)
  if (seen?.raw === raw) return seen.records
  const records = raw === null ? new Map<string, StoredRecord>() : parseRecords(raw)
  seen = { raw, records }
  return records
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

/** The library in this browser's localStorage (ADR 0001), the form of a device that refuses IndexedDB: the whole library is one value, so every write goes inside the
 * save call (the flush on pagehide keeps its guarantee) and only its answer comes later. */
const localStorageLibraryStore: LibraryStore = {
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
  // A localStorage write lands inside the save call, so a closing page has nothing under way.
  noteClosing: () => undefined,
}


/** How long one try at the database has before it counts as not answering; a moved device tries twice, four seconds in all
 * (ADR 0094). */
const ATTEMPT_MS = 2000

function withinTime<T>(attempt: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('IndexedDB did not answer')), ATTEMPT_MS)
    attempt().then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** An attempt, and once more if it fails or doesn't answer. */
async function twice<T>(attempt: () => Promise<T>): Promise<T> {
  try {
    return await withinTime(attempt)
  } catch {
    return withinTime(attempt)
  }
}

function deviceMoved(): boolean {
  try {
    return localStorage.getItem(MOVED_FLAG) === '1'
  } catch {
    return false
  }
}

/** Opens the database of a moved device and takes in the closing note, before anything is read. */
async function openMoved(): Promise<LibraryConnection> {
  const connection = libraryConnection()
  try {
    await replayClosingNote(await connection.get())
    return connection
  } catch (error) {
    connection.close()
    throw error
  }
}

/** Where the library is kept on this device, once decided (ADR 0094). */
type Form = { kind: 'indexed'; store: LibraryStore } | { kind: 'local' } | { kind: 'unopened' }

/** Decides it: IndexedDB, or localStorage on a device that never moved and whose browser refuses, or unopened on a device
 * that moved and whose database can't be reached. A device not yet moved is copied first (the old key is only read), and
 * a copy that fails runs this start on localStorage and is tried again at the next. */
async function decideForm(): Promise<Form> {
  const moved = deviceMoved()
  if (typeof indexedDB === 'undefined') return moved ? { kind: 'unopened' } : { kind: 'local' }
  if (!moved) {
    let db: IDBDatabase | undefined
    try {
      db = await withinTime(openLibraryDatabase)
      await copyOldLibrary(db)
      localStorage.setItem(MOVED_FLAG, '1')
    } catch {
      return { kind: 'local' }
    } finally {
      db?.close()
    }
  }
  try {
    return { kind: 'indexed', store: indexedLibraryStore(await twice(openMoved)) }
  } catch {
    return { kind: 'unopened' }
  }
}

/** What a library that couldn't be opened answers: nothing is read from or written to any library. */
const unopenedLibraryStore: LibraryStore = {
  start: () => Promise.resolve('unopened'),
  count: () => Promise.resolve('unopened'),
  load: () => [],
  open: () => ({ projects: [], sealed: [] }),
  unseal: () => {
    throw new Error('The library is not open')
  },
  save: () => Promise.reject(new Error('The library is not open')),
  reread: () => Promise.resolve({ changed: [], gone: [] }),
  onOutsideChange: () => () => undefined,
  noteClosing: () => undefined,
}

/** The library as this browser keeps it (spec 1018): IndexedDB, or localStorage where it refuses. Until `start` or `count`
 * has decided, it answers as the localStorage form, which the App's tests mount over.
 * @internal Tests make a store of their own, so none remembers an earlier test's answer. */
export function createBrowserLibraryStore(): LibraryStore {
  let deciding: Promise<Form> | undefined
  let current: LibraryStore = localStorageLibraryStore
  const decide = (): Promise<Form> => (deciding ??= decideForm())
  const unopened = (): 'unopened' => {
    deciding = Promise.resolve({ kind: 'unopened' })
    current = unopenedLibraryStore
    return 'unopened'
  }
  return {
    start: async () => {
      const decided = await decide()
      if (decided.kind === 'unopened') return unopened()
      if (decided.kind === 'local') {
        current = localStorageLibraryStore
        return localStorageLibraryStore.start()
      }
      try {
        await twice(() => decided.store.start())
      } catch {
        return unopened()
      }
      current = decided.store
      return 'ready'
    },
    count: async () => {
      const decided = await decide()
      if (decided.kind === 'unopened') return unopened()
      if (decided.kind === 'local') return localStorageLibraryStore.count()
      try {
        return await twice(() => decided.store.count())
      } catch {
        return unopened()
      }
    },
    load: () => current.load(),
    open: (keepSealed) => current.open(keepSealed),
    unseal: (sealed) => current.unseal(sealed),
    save: (changed, removed) => current.save(changed, removed),
    reread: (held, keepSealed, ids) => current.reread(held, keepSealed, ids),
    onOutsideChange: (listener) => current.onOutsideChange(listener),
    noteClosing: () => current.noteClosing(),
  }
}

export const browserLibraryStore: LibraryStore = createBrowserLibraryStore()
