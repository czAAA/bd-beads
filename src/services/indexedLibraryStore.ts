import type { Project } from '../domain/project'
import { lastSaved } from '../domain/projectLibrary'
import { projectSummaryOf, type ProjectSummary, type SealedProject } from '../domain/sealedProject'
import { readKey, readOldNameKey, removeKey, removeOldNameKey } from './storageKeys'
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
  type StoredRecord,
} from './libraryFormats'

// The Project library in IndexedDB, one record per Project (ADR 0094, ADR 0012, spec 1018): the store, the copy of the old
// localStorage library, its removal and the replay of the closing note. The database is its own, never a version of
// `openbeads`, which a tab of an older build holds open.

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
  /** When the old library was last copied or taken in, and the starts counted since: what its removal waits on. */
  since?: number
  starts?: number
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
  return {
    id,
    format: RECORD_FORMAT,
    stored,
    stamp: newStamp(),
    summary: summary ?? null,
  }
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
 * never written or deleted here; an empty, missing or unreadable library copies nothing. Rejects when the copy fails. */
export async function copyOldLibrary(db: IDBDatabase): Promise<void> {
  const raw = readKey(localStorage, STORAGE_KEY)
  const entries = new Map<string, { stored: string; summary: ProjectSummary | undefined }>()
  let readable = raw !== null
  if (raw !== null) {
    try {
      for (const [id, record] of parseRecords(raw)) {
        const stored = stampOf(record)
        entries.set(id, {
          stored,
          summary: projectSummaryOf(JSON.parse(stored)),
        })
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
      ...waitFromNow(),
    }
    const remember = db.transaction(META, 'readwrite')
    remember.objectStore(META).put(memo)
    await finished(remember)
  }
}

// --- The old library, taken in -----------------------------------------------------------------------------------------

/** Takes in what an older build's tab saved into the old library (ADR 0094): if its digest differs from the remembered one,
 * each Project new or changed there is written when its last save is newer than the record's. Adds and updates only;
 * a missing or unreadable value changes nothing. Answers the ids written. */
export async function takeInOldLibrary(db: IDBDatabase): Promise<string[]> {
  const raw = readKey(localStorage, STORAGE_KEY)
  if (raw === null) return []
  const digest = digestOf(raw)
  const memo = await wrap(db.transaction(META, 'readonly').objectStore(META).get(OLD_LIBRARY) as IDBRequest<OldLibraryMemo | undefined>)
  if (memo?.digest === digest) return []
  let entries: Map<string, StoredRecord>
  try {
    entries = parseRecords(raw)
  } catch {
    return []
  }
  const remembered = memo?.projects ?? {}
  // Earlier digests stay, so a Project that leaves the old library and comes back unchanged isn't taken for new.
  const projects: Record<string, string> = { ...remembered }
  const changed: {
    id: string
    stored: string
    summary: ProjectSummary | undefined
  }[] = []
  for (const [id, record] of entries) {
    const stored = stampOf(record)
    projects[id] = digestOf(stored)
    if (remembered[id] === projects[id]) continue
    try {
      changed.push({
        id,
        stored,
        summary: projectSummaryOf(JSON.parse(stored)),
      })
    } catch {
      // A Project of the old library that can't be read is left out.
    }
  }
  const transaction = db.transaction([PROJECTS, META], 'readwrite')
  const store = transaction.objectStore(PROJECTS)
  const written: string[] = []
  for (const { id, stored, summary } of changed) {
    if (!summary) continue
    getRecord(store, id, (record) => {
      if (record !== undefined && !known(record)) return
      if (record?.summary && lastSaved(record.summary) >= lastSaved(summary)) return
      store.put(recordOf(id, stored, summary))
      written.push(id)
    })
  }
  // A value an older build wrote starts the wait for the old library's removal again.
  transaction.objectStore(META).put({ key: OLD_LIBRARY, digest, projects, ...waitFromNow() } satisfies OldLibraryMemo)
  await finished(transaction)
  return written
}

// --- The old library, removed -------------------------------------------------------------------------------------------

/** How long the old library stays as the backup after it was last copied or taken in (ADR 0094, ticket 1023): this many
 * days and this many starts, both. */
const KEEP_MS = 14 * 24 * 60 * 60 * 1000
const KEEP_STARTS = 10

/** The wait as it begins: what a copy or a take-in of the old library remembers. */
const waitFromNow = (): Pick<OldLibraryMemo, 'since' | 'starts'> => ({ since: Date.now(), starts: 0 })

/** Whether the records hold everything an old library value does: this build reads every Project in it, and each one's
 * record is at least as new. A Project with no record was removed here after the move. */
async function heldByRecords(db: IDBDatabase, raw: string): Promise<boolean> {
  const summaries: ProjectSummary[] = []
  try {
    const parsed: unknown = JSON.parse(raw)
    const stored = Array.isArray(parsed) ? parsed : (parsed as { patterns?: unknown } | null)?.patterns
    const entries = parseRecords(raw)
    // A Project the reader leaves out (a Technique this build doesn't know) lives only in the old library.
    if (!Array.isArray(stored) || stored.length !== entries.size) return false
    for (const record of entries.values()) {
      const summary = projectSummaryOf(JSON.parse(stampOf(record)))
      if (!summary) return false
      summaries.push(summary)
    }
  } catch {
    return false
  }
  const store = db.transaction(PROJECTS, 'readonly').objectStore(PROJECTS)
  const records = await Promise.all(summaries.map(({ id }) => wrap(store.get(id) as IDBRequest<LibraryRecord | undefined>)))
  return summaries.every((summary, index) => {
    const record = records[index]
    if (record === undefined) return true
    return known(record) && record.summary !== null && lastSaved(record.summary) >= lastSaved(summary)
  })
}

/** Counts this start and, once the old library has waited long enough and the records hold everything in it, deletes it
 * from localStorage, its old-name copy with it (ADR 0094, ticket 1023). The reader stays. Answers whether it was deleted. */
export async function removeOldLibraryOnceSafe(db: IDBDatabase, now = Date.now()): Promise<boolean> {
  const raw = readKey(localStorage, STORAGE_KEY)
  if (raw === null) return false
  const digest = digestOf(raw)
  let waited = false
  const transaction = db.transaction(META, 'readwrite')
  const meta = transaction.objectStore(META)
  const request = meta.get(OLD_LIBRARY) as IDBRequest<OldLibraryMemo | undefined>
  request.onsuccess = () => {
    const memo = request.result
    // A value never copied or taken in (this build can't read it) has no wait to count: it stays.
    if (memo?.digest !== digest) return
    const since = memo.since ?? now
    const starts = (memo.starts ?? 0) + 1
    meta.put({ ...memo, since, starts } satisfies OldLibraryMemo)
    waited = now - since >= KEEP_MS && starts >= KEEP_STARTS
  }
  await finished(transaction)
  if (!waited || !(await heldByRecords(db, raw))) return false
  const oldName = readOldNameKey(localStorage, STORAGE_KEY)
  const oldNameHeld = oldName === null || oldName === raw || (await heldByRecords(db, oldName))
  // An older build's tab may have written while the records were read: that value hasn't been taken in or checked.
  if (localStorage.getItem(STORAGE_KEY) !== raw) return false
  removeKey(localStorage, STORAGE_KEY)
  if (oldNameHeld && readOldNameKey(localStorage, STORAGE_KEY) === oldName) removeOldNameKey(localStorage, STORAGE_KEY)
  return true
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

/** The channel tabs of this build tell each other of their writes on. */
const CHANNEL = 'openbeads-library'

/** What a save tells the other tabs: the Projects it wrote and the ones it removed. */
interface LibraryMessage {
  written: string[]
  removed: string[]
}

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
  let channel: BroadcastChannel | undefined
  const channelOf = (): BroadcastChannel | undefined => {
    if (channel === undefined && typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel(CHANNEL)
      } catch {
        return undefined
      }
    }
    return channel
  }

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
    if (written.length > 0 || removed.length > 0) {
      try {
        channelOf()?.postMessage({
          written: written.map(([project]) => project.id),
          removed: [...removed],
        } satisfies LibraryMessage)
      } catch {
        // The channel is a nicety: a tab that misses the message rereads when it becomes visible.
      }
    }
    return { dropped }
  }

  return {
    start: async () => {
      const db = await connection.get()
      loaded = (await wrap(db.transaction(PROJECTS, 'readonly').objectStore(PROJECTS).getAll() as IDBRequest<LibraryRecord[]>)).filter(
        known,
      )
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
      for (const { project } of changed)
        entries.projects[project.id] = {
          stored: stampOf(project),
          at: lastSaved(project),
        } satisfies NotedProject
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
    // Another tab's write is heard on the channel; an older build's save into the old key, by the `storage` event, is taken in
    // first; a tab that was hidden rereads everything when it is shown again, for a message it missed.
    onOutsideChange: (listener) => {
      const stops: (() => void)[] = []
      const heard = channelOf()
      if (heard) {
        const onMessage = (event: MessageEvent<LibraryMessage>) => {
          const { written = [], removed = [] } = event.data ?? {}
          listener([...written, ...removed])
        }
        heard.addEventListener('message', onMessage)
        stops.push(() => heard.removeEventListener('message', onMessage))
      }
      const onStorage = (event: StorageEvent) => {
        if (event.key !== STORAGE_KEY && event.key !== null) return
        void connection
          .get()
          .then((db) => takeInOldLibrary(db))
          .then((written) => {
            if (written.length === 0) return
            // Tabs that took in nothing themselves (this tab got there first) are told of the records written.
            channelOf()?.postMessage({
              written,
              removed: [],
            } satisfies LibraryMessage)
            listener(written)
          })
          .catch(() => undefined)
      }
      window.addEventListener('storage', onStorage)
      stops.push(() => window.removeEventListener('storage', onStorage))
      const onVisible = () => {
        if (document.visibilityState === 'visible') listener(undefined)
      }
      document.addEventListener('visibilitychange', onVisible)
      stops.push(() => document.removeEventListener('visibilitychange', onVisible))
      return () => stops.forEach((stop) => stop())
    },
    noteClosing: () => {
      for (const write of underway) {
        const merged = mergeIntoNote(localStorage, write.entries)
        if (merged.projects.length === 0 && merged.removed.length === 0) continue
        const put: NoteEntries = {
          projects: Object.fromEntries(merged.projects.map((id) => [id, write.entries.projects[id]!])),
          removed: merged.removed,
        }
        noted.set(write, put)
      }
    },
  }
}
