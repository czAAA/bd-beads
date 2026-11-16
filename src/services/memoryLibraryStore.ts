import type { Project } from '../domain/project'
import type { SealedProject } from '../domain/sealedProject'
import type { HeldProject, LibraryStore, OutsideChange, ProjectChange } from './libraryStore'

/** The library in memory (the Homepage's demo, and tests): the same interface as the browser's, with a write that
 * lands later than its call, and the means for a test to hold that landing back or refuse it. */
export interface MemoryLibraryStore extends LibraryStore {
  /** Holds the landing of every save from now on until the returned function is called. */
  holdWrites: () => () => void
  /** Makes every save that lands from now on fail, as a device out of room does; the returned function stops it. */
  refuseWrites: () => () => void
  /** What the store holds now, in the order it lists them. */
  stored: () => readonly Project[]
}

/** A library kept in memory, starting with `projects`. Each Project's record has a stamp of its own, new on every write;
 * a write lands in a later microtask, and its listeners hear it after, as the browser's other tabs would. */
export function memoryLibraryStore(projects: readonly Project[] = []): MemoryLibraryStore {
  const records = new Map<string, { project: Project; stamp: string }>()
  const stamps = new WeakMap<HeldProject, string>()
  let written = 0
  const keep = (project: Project) => {
    const stamp = String(++written)
    records.set(project.id, { project, stamp })
    stamps.set(project, stamp)
  }
  projects.forEach(keep)
  const listeners = new Set<(named: OutsideChange) => void>()
  let holding = 0
  let refusing = 0
  const waiting: (() => void)[] = []

  const land = (changed: readonly ProjectChange[], removed: readonly string[]) => {
    if (refusing > 0) throw new Error('The device refused the write')
    const dropped: string[] = []
    for (const { project, knownStored } of changed) {
      if (knownStored && !records.has(project.id)) dropped.push(project.id)
      else keep(project as Project)
    }
    for (const id of removed) records.delete(id)
    const named = [...changed.map((change) => change.project.id).filter((id) => !dropped.includes(id)), ...removed]
    queueMicrotask(() => listeners.forEach((listener) => listener(named)))
    return { dropped }
  }

  return {
    start: async () => 'ready' as const,
    count: async () => records.size,
    load: () => [...records.values()].map((record) => record.project),
    open: () => ({ projects: [...records.values()].map((record) => record.project), sealed: [] }),
    unseal: (_sealed: SealedProject) => {
      throw new Error('A library in memory keeps nothing sealed')
    },
    save: (changed, removed) =>
      new Promise((resolve, reject) => {
        const settle = () => {
          try {
            resolve(land(changed, removed))
          } catch (error) {
            reject(error)
          }
        }
        if (holding > 0) waiting.push(settle)
        else queueMicrotask(settle)
      }),
    reread: async (held, _keepSealed, ids) => {
      const named = ids === undefined ? undefined : new Set(ids)
      const heldStamps = new Map(held.map((project) => [project.id, stamps.get(project)]))
      const changed = [...records.values()]
        .filter((record) => (named === undefined || named.has(record.project.id)) && heldStamps.get(record.project.id) !== record.stamp)
        .map((record) => record.project)
      const gone = [...heldStamps.keys()].filter((id) => !records.has(id) && (named === undefined || named.has(id)))
      return { changed, gone }
    },
    noteClosing: () => undefined,
    onOutsideChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    holdWrites: () => {
      holding += 1
      let released = false
      return () => {
        if (released) return
        released = true
        holding -= 1
        if (holding === 0) waiting.splice(0).forEach((settle) => queueMicrotask(settle))
      }
    },
    refuseWrites: () => {
      refusing += 1
      let stopped = false
      return () => {
        if (!stopped) refusing -= 1
        stopped = true
      }
    },
    stored: () => [...records.values()].map((record) => record.project),
  }
}
