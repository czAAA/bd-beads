// Where reference images' pictures are kept on the device (ADR 0089, ticket 0790): IndexedDB beside the library, one
// Blob per Project id. The library is one localStorage value rewritten on every save (ADR 0012), so the bytes can't live
// there. Never throws: a device that refuses (a private window can) answers false or nothing.

export interface PictureStore {
  /** The picture kept for a Project, if any. */
  get(projectId: string): Promise<Blob | undefined>
  /** Keeps a Project's picture; false where the device refused to. */
  put(projectId: string, picture: Blob): Promise<boolean>
  /** Takes a Project's picture away. */
  remove(projectId: string): Promise<void>
  /** Drops every picture whose Project is not among `projectIds`: one left by a Project removed elsewhere. */
  keepOnly(projectIds: ReadonlySet<string>): Promise<void>
}

const DATABASE = 'openbeads'
const STORE = 'reference-images'

let opening: Promise<IDBDatabase | undefined> | undefined

/** The database, opened once; nothing where the browser has no IndexedDB or refuses it. */
function database(): Promise<IDBDatabase | undefined> {
  opening ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(undefined)
      const request = indexedDB.open(DATABASE, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(undefined)
      request.onblocked = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
  return opening
}

/** Runs one request on the store and answers its result, or `fallback` on any failure. */
async function withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest, fallback: T, read: (result: unknown) => T): Promise<T> {
  const db = await database()
  if (!db) return fallback
  return new Promise<T>((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode)
      const request = work(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(read(request.result))
      transaction.onerror = () => resolve(fallback)
      transaction.onabort = () => resolve(fallback)
    } catch {
      resolve(fallback)
    }
  })
}

export const browserPictureStore: PictureStore = {
  get: (projectId) => withStore('readonly', (store) => store.get(projectId), undefined, (result) => (result instanceof Blob ? result : undefined)),
  put: (projectId, picture) => withStore('readwrite', (store) => store.put(picture, projectId), false, () => true),
  remove: async (projectId) => {
    await withStore('readwrite', (store) => store.delete(projectId), undefined, () => undefined)
  },
  keepOnly: async (projectIds) => {
    const keys = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys(), [], (result) => result as IDBValidKey[])
    await Promise.all(keys.filter((key) => typeof key !== 'string' || !projectIds.has(key)).map((key) => withStore('readwrite', (store) => store.delete(key), undefined, () => undefined)))
  },
}
