import type { Project } from '../domain/project'
import { drawablePicture, preparePicture } from './referencePicture'
import { browserDevicePreferences, createDevicePreferences, PREFERENCES, type DevicePreferences, type PreferenceName, type PreferenceStorage } from './devicePreferences'
import { browserFeedback } from './feedback'
import { downloadFile } from './fileDownload'
import { decodeImageFile } from './imageDecode'
import { readClipboardImage } from './clipboardImage'
import type { LibraryStore } from './libraryStore'
import type { ProjectKeyedStore } from './deviceDatabase'
import { browserFileWriter } from './fileWriter'
import type { SinceFiles } from './sinceFileStore'
import type { Services } from './index'
import { soleProjectLocks } from './projectLocks'

/** The page's own choices the demo shows live and never changes: it has no Language or Theme of its own. */
const LIVE: readonly PreferenceName[] = ['locale', 'theme']
/** The device's ways of drawing, which the demo starts with but keeps to itself. */
const SEEDED: readonly PreferenceName[] = ['inputMode', 'handedness', 'penSeen']

/** A storage that is a map in memory. */
function memoryStorage(seed: ReadonlyMap<string, string> = new Map()): PreferenceStorage {
  const kept = new Map(seed)
  return {
    getItem: (key) => kept.get(key) ?? null,
    setItem: (key, value) => void kept.set(key, value),
    removeItem: (key) => void kept.delete(key),
  }
}

/** Preferences that are the demo's own, in memory, but the page's language and theme, and its ways of drawing to start
 * with. */
function memoryPreferences(page: DevicePreferences, pageStorage: () => PreferenceStorage | undefined, start: Partial<Record<PreferenceName, string>>): DevicePreferences {
  const seed = new Map<string, string>()
  for (const [name, raw] of Object.entries(start)) if (raw !== undefined) seed.set(PREFERENCES[name as PreferenceName].key, raw)
  for (const name of SEEDED) {
    const key = PREFERENCES[name].key
    try {
      const raw = pageStorage()?.getItem(key)
      if (raw !== null && raw !== undefined) seed.set(key, raw)
    } catch {
      // Storage blocked: the demo starts on the defaults.
    }
  }
  const own = createDevicePreferences(memoryStorage(seed))
  return {
    get: (name) => (LIVE.includes(name) ? page.get(name) : own.get(name)),
    forget: own.forget,
  }
}

/** A library kept in memory, starting with `projects`; each save is a revision of its own, and its listeners hear
 * every one after it, as the browser's other tabs would. */
function memoryLibrary(projects: readonly Project[]): LibraryStore {
  let kept = [...projects]
  let revision = 0
  const listeners = new Set<() => void>()
  return {
    load: () => [...kept],
    open: () => ({ projects: [...kept], sealed: [], revision: String(revision) }),
    unseal: () => {
      throw new Error('A library in memory keeps nothing sealed')
    },
    save: (next) => {
      kept = [...next]
      revision += 1
      queueMicrotask(() => listeners.forEach((listener) => listener()))
      return String(revision)
    },
    reread: (since) => (since === String(revision) ? undefined : { projects: [...kept], sealed: [], revision: String(revision) }),
    onOutsideChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Values kept per Project in memory: reference images' pictures, Linked files. */
function memoryKeyed<T>(): ProjectKeyedStore<T> {
  const kept = new Map<string, T>()
  return {
    get: async (id) => kept.get(id),
    put: async (id, value) => {
      kept.set(id, value)
      return true
    },
    remove: async (id) => void kept.delete(id),
    keepOnly: async (ids) => {
      for (const id of [...kept.keys()]) if (!ids.has(id)) kept.delete(id)
    },
  }
}

/** How far each Project is behind its file, in memory. */
function memorySinceFiles() {
  let kept: SinceFiles = {}
  return { read: () => kept, write: (records: SinceFiles) => void (kept = records) }
}

/** Where the demo's preferences come from. */
interface MemoryServicesOptions {
  /** The page's own preferences, whose language and theme the demo shows. */
  page?: DevicePreferences
  /** The page's storage, which the demo's ways of drawing start from. */
  pageStorage?: () => PreferenceStorage | undefined
  /** Preferences the demo starts with, as they are stored. */
  start?: Partial<Record<PreferenceName, string>>
}

/** The services of the Homepage's demo editor (ticket 0797): its library, pictures and preferences live in memory only,
 * so nothing done in it is saved or reaches the beader's Projects, preferences, pictures or Linked files. A file it
 * exports or saves is a real file of it, and a picture it converts or lays under the beads is read as the editor does. */
export function memoryServices(projects: readonly Project[], options: MemoryServicesOptions = {}): Services {
  const { page = browserDevicePreferences, pageStorage = () => localStorage, start = {} } = options
  return {
    libraryStore: memoryLibrary(projects),
    downloadFile,
    decodeImage: decodeImageFile,
    readClipboardImage,
    devicePreferences: memoryPreferences(page, pageStorage, start),
    appUpdates: { onReady: () => () => undefined, apply: () => undefined },
    // Kept already, so the demo never asks the browser to keep a library it doesn't save.
    persistentStorage: { persisted: async () => true, persist: async () => undefined },
    feedback: browserFeedback,
    openingNote: { read: () => undefined, write: () => undefined, clear: () => undefined },
    openingAddress: () => ({ savedProjects: false }),
    pictureStore: memoryKeyed<Blob>(),
    fileWriter: browserFileWriter,
    linkedFiles: memoryKeyed(),
    sinceFiles: memorySinceFiles(),
    projectLocks: soleProjectLocks,
    preparePicture,
    drawablePicture,
  }
}
