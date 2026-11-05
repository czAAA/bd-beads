// What the device keeps beside the library in IndexedDB (ADR 0089, ADR 0090): database `openbeads`, a store per kind of
// value keyed by Project id, as the library is one localStorage value rewritten on every save (ADR 0012). Never throws:
// a device that refuses (a private window can) answers false or nothing.

/** One store of values kept per Project id. */
export interface ProjectKeyedStore<T> {
  /** The value kept for a Project, if any. */
  get(projectId: string): Promise<T | undefined>
  /** Keeps a Project's value; false where the device refused to. */
  put(projectId: string, value: T): Promise<boolean>
  /** Takes a Project's value away. */
  remove(projectId: string): Promise<void>
  /** Drops every value whose Project is not among `projectIds`: one left by a Project removed elsewhere. */
  keepOnly(projectIds: ReadonlySet<string>): Promise<void>
}

const DATABASE = 'openbeads'
/** Version 2 adds the Linked files (ticket 0796); an upgrade makes whichever store is missing. */
const VERSION = 2
const STORES = ['reference-images', 'linked-files'] as const
type StoreName = (typeof STORES)[number]

let opening: Promise<IDBDatabase | undefined> | undefined

/** The database, opened once; nothing where the browser has no IndexedDB or refuses it. */
function database(): Promise<IDBDatabase | undefined> {
  opening ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(undefined)
      const request = indexedDB.open(DATABASE, VERSION)
      request.onupgradeneeded = () => {
        for (const store of STORES) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(undefined)
      request.onblocked = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
  return opening
}

/** Runs one request on a store and answers its result, or `fallback` on any failure. */
async function withStore<T>(name: StoreName, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest, fallback: T, read: (result: unknown) => T): Promise<T> {
  const db = await database()
  if (!db) return fallback
  return new Promise<T>((resolve) => {
    try {
      const transaction = db.transaction(name, mode)
      const request = work(transaction.objectStore(name))
      transaction.oncomplete = () => resolve(read(request.result))
      transaction.onerror = () => resolve(fallback)
      transaction.onabort = () => resolve(fallback)
    } catch {
      resolve(fallback)
    }
  })
}

/** The store `name`, whose values `isValue` recognises (anything else reads as nothing). */
export function projectKeyedStore<T>(name: StoreName, isValue: (value: unknown) => value is T): ProjectKeyedStore<T> {
  return {
    get: (projectId) => withStore(name, 'readonly', (store) => store.get(projectId), undefined, (result) => (isValue(result) ? result : undefined)),
    put: (projectId, value) => withStore(name, 'readwrite', (store) => store.put(value, projectId), false, () => true),
    remove: async (projectId) => {
      await withStore(name, 'readwrite', (store) => store.delete(projectId), undefined, () => undefined)
    },
    keepOnly: async (projectIds) => {
      const keys = await withStore<IDBValidKey[]>(name, 'readonly', (store) => store.getAllKeys(), [], (result) => result as IDBValidKey[])
      await Promise.all(keys.filter((key) => typeof key !== 'string' || !projectIds.has(key)).map((key) => withStore(name, 'readwrite', (store) => store.delete(key), undefined, () => undefined)))
    },
  }
}
