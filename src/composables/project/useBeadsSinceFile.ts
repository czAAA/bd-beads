import { computed, shallowRef, watch } from 'vue'
import { changedBeadCount, countedBeads, type SinceFile } from '../../domain/beadsSinceFile'
import type { Layered } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { SinceFileStore, SinceFiles } from '../../services/sinceFileStore'

/** What the count needs from the app shell: the open Project, every Project in the library, and where it is kept. */
export interface BeadsSinceFileDeps {
  currentProject: () => Project | undefined
  /** Every Project in the library, sealed ones too: a record of none is dropped (Delete, Delete all, start-up). */
  libraryIds: () => readonly string[]
  store: SinceFileStore
  now?: () => number
}

const NONE: SinceFile = { beads: 0 }

/** Beads since last file (SaveReminder card, ticket 0796): each Project's count of drawing since its last Project file on
 * this device, and when that was, kept beside the library so a reload keeps them. Edit, Undo and Redo count through
 * `count`; any Project file save puts it back to 0. */
export function useBeadsSinceFile(deps: BeadsSinceFileDeps) {
  const now = deps.now ?? Date.now
  const records = shallowRef<SinceFiles>(deps.store.read())

  function write(next: SinceFiles) {
    records.value = next
    deps.store.write(next)
  }

  function recordOf(projectId: string): SinceFile {
    return records.value[projectId] ?? NONE
  }

  /** The open Project's record; a Project never counted reads as 0 with no file yet. */
  const current = computed(() => {
    const project = deps.currentProject()
    return project ? recordOf(project.id) : NONE
  })

  /** An Edit (sign 1), its Undo (-1) or its Redo (1) on the open Project: the beads it changed, added or taken off. */
  function count(before: Layered, after: Layered, sign: 1 | -1) {
    const project = deps.currentProject()
    const changed = project ? changedBeadCount(before, after) : 0
    if (project && changed > 0) write({ ...records.value, [project.id]: countedBeads(recordOf(project.id), sign * changed) })
  }

  /** A Project file of these Projects reached the device: each counts from 0 again, as of now, with that file's name. */
  function fileSaved(projectIds: readonly string[], fileName: string) {
    const at = now()
    write({ ...records.value, ...Object.fromEntries(projectIds.map((id) => [id, { beads: 0, lastFileAt: at, fileName }])) })
  }

  /** A duplicate starts with its original's count and last-file time, but no file's name: that file holds the original. */
  function duplicated(sourceId: string, copyId: string) {
    const source = records.value[sourceId]
    if (!source) return
    const { fileName: _, ...counted } = source
    write({ ...records.value, [copyId]: counted })
  }

  /** An imported Project came from a file: it starts at 0, with no file saved on this device yet. */
  function imported(projectIds: readonly string[]) {
    write({ ...records.value, ...Object.fromEntries(projectIds.map((id) => [id, NONE])) })
  }

  /** Keeps only the records of `projectIds`. */
  function keepOnly(projectIds: readonly string[]) {
    const kept = new Set(projectIds)
    const left = Object.fromEntries(Object.entries(records.value).filter(([id]) => kept.has(id)))
    if (Object.keys(left).length !== Object.keys(records.value).length) write(left)
  }

  // At start every record of no Project is dropped; then a Project gone from the library takes its record with it.
  keepOnly(deps.libraryIds())
  watch(deps.libraryIds, (now, before) => {
    const kept = new Set(now)
    if (before?.some((id) => !kept.has(id))) keepOnly(now)
  })

  return { current, count, fileSaved, duplicated, imported }
}
