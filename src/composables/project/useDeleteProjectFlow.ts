import { ref, watch } from 'vue'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import type { LibraryEntry } from './useSavedProjectConfirms'

/** What deleting a Project needs from the app shell: the library's lookup and removal, and Save Project file. */
export interface DeleteProjectDeps {
  findProject: (id: string) => LibraryEntry | undefined
  /** Removes it from this device; the library then opens the most recently updated other Project, or none. */
  removeProject: (id: string) => void
  /** Save Project file for that Project, open or not: the Project panel's own action. */
  saveProjectFile: (id: string) => unknown
  /** The open Project's id, or none: whether a delete left the Canvas empty. */
  openProjectId: () => string | undefined
  /** The dialog registry its question opens through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

/** Deleting a Project (ticket 0842; ConfirmDialogs card): the library's ×, the Project panel's Delete project and the
 * missed Project notice's Remove ask the one question, "Delete “{name}”?", which offers Save Project file first and
 * stays open while it saves. Deps are lazy. */
export function useDeleteProjectFlow(deps: DeleteProjectDeps) {
  const dialogs = deps.dialogs ?? useDialogs()
  /** The Project asked about, until the person answers. */
  const pendingDelete = dialogs.question<LibraryEntry>('delete-project')
  /** The name of the Project whose delete left no Project open, which the empty Canvas tells (ticket 0840); cleared once
   * a Project opens. */
  const deletedName = ref<string>()
  watch(deps.openProjectId, (id) => {
    if (id) deletedName.value = undefined
  })

  function onRequestDelete(id: string) {
    const entry = deps.findProject(id)
    if (entry) pendingDelete.value = entry
  }

  function onCancelDelete() {
    pendingDelete.value = undefined
  }

  /** The dialog's Save Project file: the file is saved and the question stays, so Delete or Cancel follows. */
  function onSaveFileBeforeDelete() {
    const entry = pendingDelete.value
    if (entry) void deps.saveProjectFile(entry.id)
  }

  /** Every delete's aftermath, in one place: the Project goes, and the most recent other one opens (the empty Canvas
   * with none left). */
  function onConfirmDelete() {
    const entry = pendingDelete.value
    pendingDelete.value = undefined
    if (!entry) return
    deps.removeProject(entry.id)
    deletedName.value = deps.openProjectId() ? undefined : entry.name
  }

  return { deletedName, pendingDelete, onRequestDelete, onCancelDelete, onSaveFileBeforeDelete, onConfirmDelete }
}
