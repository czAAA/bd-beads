import type { Project } from '../domain/project'
import { lastSaved } from '../domain/projectLibrary'
import { projectSummaryOf, type ProjectSummary, type SealedProject } from '../domain/sealedProject'
import { readKey } from './storageKeys'
import { clearNote, mergeIntoNote, readNote, takeOutOfNote, type NoteEntries, type NotedProject } from './closingNote'
import {
  STORAGE_KEY,
  heldFromRecord,
  parseRecords,
  stampOf,
  summaryOf,
  unsealProject,
  type HeldProject,
  type LibraryStore,
  type ProjectChange,
  type Reread,
  type SaveResult,
} from './libraryFormats'

// The Project library in IndexedDB, one record per Project (ADR 0094, ADR 0012, spec 1018): the store, the copy of the old
// localStorage library and the replay of the closing note. The database is its own, never a version of `openbeads`, which a
// tab of an older build holds open.

/** @internal Tests read the database under its name. */
export const LIBRARY_DATABASE = 'openbeads-library'
const PROJECTS = 'projects'
const META = 'meta'
const BY_FORMAT = 'format'
/** The localStorage flag that says this device keeps its library in IndexedDB. */
export const MOVED_FLAG = 'openbeads:library-in-indexeddb'
/** The `meta` row that remembers what the old library held when it was last taken in. */
const OLD_LIBRARY = 'old-library'

/** What `stored` is in a record: a Project as library version 6 writes it. A record of another format is left alone.
 * @internal Tests read records with it. */
export const RECORD_FORMAT = 1

/** A Project's record. */
interface LibraryRecord {
  id: string
  format: number
  stored: string
  /** New on every write: tabs compare stamps to know what changed. */
  stamp: string
  summary: ProjectSummary | null
}

interface OldLibraryMemo {
  key: string
  /** A digest of the whole old value, so an unchanged library is never parsed again. */
  digest: string
  /** A digest per Project. */
  projects: Record<string, string>
}

const wrap = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })

/** Reads a record inside a transaction and hands it to `then` from the request's own event, where the transaction is
 * still open to write. */
function getRecord(store: IDBObjectStore, id: string, then: (record: LibraryRecord | undefined) => void): void {
  const request = store.get(id) as IDBRequest<LibraryRecord | undefined>
  request.onsuccess = () => then(request.result)
}

const finished = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })

/** A short digest of a string (cyrb53): enough to tell two stored values apart cheaply. */
function digestOf(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${text.length}-${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`
}

let stampCount = 0
const newStamp = (): string => `${Date.now().toString(36)}-${(stampCount += 1).toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function recordOf(id: string, stored: string, summary: ProjectSummary | undefined): LibraryRecord {
  return { id, format: RECORD_FORMAT, stored, stamp: newStamp(), summary: summary ?? null }
}

const known = (record: LibraryRecord | undefined): record is LibraryRecord => record !== undefined && record.format === RECORD_FORMAT

/** The connection to the library database. It closes when the browser asks (a later version of the database is never
 * blocked by an open tab) and opens again when next used. */
export interface LibraryConnection {
  get: () => Promise<IDBDatabase>
  close: () => void
}

/** Opens the library database, creating it on first use. Rejects when the browser refuses. */
export function openLibraryDatabase(onClosed: () => void = () => undefined): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(LIBRARY_DATABASE, 1)
    } catch (error) {
      reject(error)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore(PROJECTS, { keyPath: 'id' }).createIndex(BY_FORMAT, 'format')
      db.createObjectStore(META, { keyPath: 'key' })
    }
    request.onsuccess = () => {
      const db = request.result
      // `close` is not fired for a close made here, so whoever holds the connection is told.
      db.onversionchange = () => {
        db.close()
        onClosed()
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'))
    request.onblocked = () => reject(new Error('IndexedDB is blocked'))
  })
}

/** A connection to the library database that opens on first use and again after the browser closed it. */
export function libraryConnection(): LibraryConnection {
  let db: IDBDatabase | undefined
  let opening: Promise<IDBDatabase> | undefined
  return {
    get: () => {
      if (db) return Promise.resolve(db)
      opening ??= openLibraryDatabase(() => (db = undefined)).then(
        (opened) => {
          db = opened
          opening = undefined
          return opened
        },
        (error: unknown) => {
          opening = undefined
          throw error
        },
      )
      return opening
    },
    close: () => {
      db?.close()
      db = undefined
    },
  }
}

// --- The copy -----------------------------------------------------------------------------------------------------------

/** Copies the old localStorage library into the database (ADR 0094): every stored version through its reader, each Project
 * a record, in one transaction, read back and compared; only then is the old library remembered in `meta`. The old key is
 * never written or deleted; an empty, missing or unreadable library copies nothing. Rejects when the copy fails. */
export async function copyOldLibrary(db: IDBDatabase): Promise<void> {
  const raw = readKey(localStorage, STORAGE_KEY)
  const entries = new Map<string, { stored: string; summary: ProjectSummary | undefined }>()
  let readable = raw !== null
  if (raw !== null) {
    try {
      for (const [id, record] of parseRecords(raw)) {
        const stored = stampOf(record)
        entries.set(id, { stored, summary: projectSummaryOf(JSON.parse(stored)) })
      }
    } catch {
      entries.clear()
      readable = false
    }
  }
  if (entries.size > 0) {
    const write = db.transaction(PROJECTS, 'readwrite')
    const store = write.objectStore(PROJECTS)
    // A failed copy left earlier: the old library is the truth until the flag is set, so records it no longer holds go.
    const existing = store.index(BY_FORMAT).getAllKeys(RECORD_FORMAT)
    existing.onsuccess = () => {
      for (const key of existing.result) if (!entries.has(String(key))) store.delete(key)
    }
    for (const [id, { stored, summary }] of entries) store.put(recordOf(id, stored, summary))
    await finished(write)
    const back = db.transaction(PROJECTS, 'readonly')
    const read = await wrap(back.objectStore(PROJECTS).getAll() as IDBRequest<LibraryRecord[]>)
    const copied = new Map(read.filter(known).map((record) => [record.id, record.stored]))
    for (const [id, { stored }] of entries) {
      if (copied.get(id) !== stored) throw new Error(`The copy of Project ${id} does not match`)
    }
  }
  if (readable && raw !== null) {
    const memo: OldLibraryMemo = {
      key: OLD_LIBRARY,
      digest: digestOf(raw),
      projects: Object.fromEntries([...entries].map(([id, { stored }]) => [id, digestOf(stored)])),
    }
    const remember = db.transaction(META, 'readwrite')
    remember.objectStore(META).put(memo)
    await finished(remember)
  }
}

// --- The closing note ---------------------------------------------------------------------------------------------------

/** Writes what the closing note holds into the records, each entry unless its record is newer, applies each removal, and
 * clears the note. */
export async function replayClosingNote(db: IDBDatabase): Promise<void> {
  const note = readNote(localStorage)
  const ids = Object.keys(note.projects)
  if (ids.length === 0 && note.removed.length === 0) {
    clearNote(localStorage)
    return
  }
  const transaction = db.transaction(PROJECTS, 'readwrite')
  const store = transaction.objectStore(PROJECTS)
  for (const id of note.removed) {
    getRecord(store, id, (record) => {
      if (record === undefined || known(record)) store.delete(id)
    })
  }
  for (const id of ids) {
    const entry = note.projects[id]!
    getRecord(store, id, (record) => {
      if (record !== undefined && !known(record)) return
      if (record?.summary && lastSaved(record.summary) > entry.at) return
      let summary: ProjectSummary | undefined
      try {
        summary = projectSummaryOf(JSON.parse(entry.stored))
      } catch {
        return
      }
      if (summary) store.put(recordOf(id, entry.stored, summary))
    })
  }
  await finished(transaction)
  clearNote(localStorage)
}

// --- The store ----------------------------------------------------------------------------------------------------------

/** A write started and not yet landed: what the closing note would hold of it. */
interface Underway {
  entries: NoteEntries
}

/** The library in IndexedDB. `load` reads every record before the app mounts; the rest answers over it. */
export function indexedLibraryStore(connection: LibraryConnection): LibraryStore {
  /** The stamp of the record each held Project was read or written as. */
  const stamps = new WeakMap<HeldProject, string>()
  let loaded: LibraryRecord[] = []
  const underway = new Set<Underway>()
  /** What this tab has put in the closing note, to take out when the write lands. */
  const noted = new Map<Underway, NoteEntries>()

  const openLoaded = (keepSealed: (summary: ProjectSummary) => boolean) => {
    const projects: Project[] = []
    const sealed: SealedProject[] = []
    for (const record of loaded) {
      const held = heldFromRecord(record.stored, keepSealed)
      stamps.set(held, record.stamp)
      if ('stored' in held) sealed.push(held)
      else projects.push(held)
    }
    return { projects, sealed }
  }

  async function run(changed: readonly ProjectChange[], removed: readonly string[]): Promise<SaveResult> {
    const db = await connection.get()
    const transaction = db.transaction(PROJECTS, 'readwrite')
    const store = transaction.objectStore(PROJECTS)
    const dropped: string[] = []
    const written: [HeldProject, string][] = []
    for (const { project, knownStored } of changed) {
      getRecord(store, project.id, (existing) => {
        if (existing !== undefined && !known(existing)) return
        if (existing === undefined && knownStored) {
          dropped.push(project.id)
          return
        }
        const record = recordOf(project.id, stampOf(project), summaryOf(project))
        store.put(record)
        written.push([project, record.stamp])
      })
    }
    for (const id of removed) {
      getRecord(store, id, (existing) => {
        if (existing === undefined || known(existing)) store.delete(id)
      })
    }
    await finished(transaction)
    for (const [project, stamp] of written) stamps.set(project, stamp)
    return { dropped }
  }

  return {
    start: async () => {
      const db = await connection.get()
      loaded = (await wrap(db.transaction(PROJECTS, 'readonly').objectStore(PROJECTS).getAll() as IDBRequest<LibraryRecord[]>)).filter(known)
      return 'ready'
    },
    count: async () => {
      const db = await connection.get()
      return wrap(db.transaction(PROJECTS, 'readonly').objectStore(PROJECTS).index(BY_FORMAT).count(RECORD_FORMAT))
    },
    load: () => openLoaded(() => false).projects,
    open: openLoaded,
    unseal: (sealed) => {
      const project = unsealProject(sealed)
      const stamp = stamps.get(sealed)
      if (stamp !== undefined) stamps.set(project, stamp)
      return project
    },
    save: (changed, removed) => {
      const entries: NoteEntries = { projects: {}, removed }
      for (const { project } of changed) entries.projects[project.id] = { stored: stampOf(project), at: lastSaved(project) } satisfies NotedProject
      const mine: Underway = { entries }
      underway.add(mine)
      return run(changed, removed).then(
        (result) => {
          underway.delete(mine)
          const put = noted.get(mine)
          if (put) {
            takeOutOfNote(localStorage, put)
            noted.delete(mine)
          }
          return result
        },
        (error: unknown) => {
          underway.delete(mine)
          throw error
        },
      )
    },
    reread: async (held, keepSealed, ids) => {
      const db = await connection.get()
      const store = db.transaction(PROJECTS, 'readonly').objectStore(PROJECTS)
      const named = ids === undefined ? undefined : new Set(ids)
      const records = (
        named === undefined
          ? await wrap(store.getAll() as IDBRequest<LibraryRecord[]>)
          : await Promise.all([...named].map((id) => wrap(store.get(id) as IDBRequest<LibraryRecord | undefined>)))
      ).filter((record): record is LibraryRecord => known(record))
      const heldStamps = new Map(held.map((project) => [project.id, stamps.get(project)]))
      const there = new Set(records.map((record) => record.id))
      const changed = records
        .filter((record) => heldStamps.get(record.id) !== record.stamp)
        .map((record) => {
          const fresh = heldFromRecord(record.stored, keepSealed)
          stamps.set(fresh, record.stamp)
          return fresh
        })
      const gone = [...heldStamps.keys()].filter((id) => !there.has(id) && (named === undefined || named.has(id)))
      return { changed, gone } satisfies Reread
    },
    // Other tabs' writes are heard by the channel of ticket 1021; until then a tab rereads where the library asks.
    onOutsideChange: () => () => undefined,
    noteClosing: () => {
      for (const write of underway) {
        const merged = mergeIntoNote(localStorage, write.entries)
        if (merged.projects.length === 0 && merged.removed.length === 0) continue
        const put: NoteEntries = { projects: Object.fromEntries(merged.projects.map((id) => [id, write.entries.projects[id]!])), removed: merged.removed }
        noted.set(write, put)
      }
    },
  }
}
