import { ref, watch } from 'vue'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import type { LibraryEntry } from './useSavedProjectConfirms'
import type { MessageTone, ToastAction } from '../ui/useToasts'
import type { Translations } from '../../i18n/translations'
import { fillBlanks } from '../../domain/fillBlanks'

/** The toast a delete shows (ticket 0983): one at a time, a second delete's replacing the first's. */
const DELETED_TOAST = 'project-deleted'

/** What deleting a Project needs from the app shell: the library's lookup and removal, and Save Project file. */
export interface DeleteProjectDeps {
  findProject: (id: string) => LibraryEntry | undefined
  /** Removes it from this device and holds it for Undo; the library then opens the most recently updated other
   * Project, or none. */
  removeProject: (id: string) => void
  /** Delete's Undo: the held Project back as it was, open again if it was (ticket 0983). */
  restoreRemoved: () => void
  /** The toast has gone: the held Project is let go, gone from the device. */
  forgetRemoved: () => void
  /** The open Project's name after the delete, or none: where the toast says the person is now. */
  openProjectName: () => string | undefined
  showToast: (id: string, text: string, tone?: MessageTone, action?: ToastAction) => void
  /** Whether a toast of this id is still showing: the deleted Project is held as long as its toast is. */
  toastShowing: (id: string) => boolean
  messages: () => Translations
  /** Save Project file for that Project, open or not: the Project panel's own action. */
  saveProjectFile: (id: string) => unknown
  /** The open Project's id, or none: whether a delete left the Canvas empty. Left out where no Canvas tells it (the
   * Homepage's Menu). */
  openProjectId?: () => string | undefined
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
  const { openProjectId } = deps
  if (openProjectId) {
    watch(openProjectId, (id) => {
      if (id) deletedName.value = undefined
    })
  }
  watch(
    () => deps.toastShowing(DELETED_TOAST),
    (showing) => {
      if (!showing) deps.forgetRemoved()
    },
  )

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

  /** Every delete's aftermath, in one place: the Project goes, the most recent other one opens (the empty Canvas with
   * none left), and a toast says so, naming where the person is now, with Undo for as long as it shows (ticket 0983). */
  function onConfirmDelete() {
    const entry = pendingDelete.value
    pendingDelete.value = undefined
    if (!entry) return
    const wasOpen = openProjectId?.() === entry.id
    deps.removeProject(entry.id)
    if (openProjectId) deletedName.value = openProjectId() ? undefined : entry.name
    const messages = deps.messages()
    const openNow = wasOpen ? deps.openProjectName() : undefined
    const said =
      openNow === undefined
        ? fillBlanks(messages.shell.canvasDeleted, { name: entry.name })
        : fillBlanks(messages.panels.project.deletedToast, { name: entry.name, open: openNow })
    deps.showToast(DELETED_TOAST, said, 'success', { label: messages.palette.undoButton, run: deps.restoreRemoved })
  }

  return { deletedName, pendingDelete, onRequestDelete, onCancelDelete, onSaveFileBeforeDelete, onConfirmDelete }
}
