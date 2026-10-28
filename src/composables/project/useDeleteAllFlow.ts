import { deleteAll, type Project } from '../../domain/project'
import type { EditFn } from './useEdit'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What Delete all needs from the app shell: the open Project and Edit. */
export interface DeleteAllFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

/** Delete all and its confirmation modal (ticket 42, 198; ADR 0020). Deps are read lazily. */
export function useDeleteAllFlow(deps: DeleteAllFlowDeps) {
  /** Whether the Delete all confirmation modal (ticket 42) is open. The global Escape handler defers to the modal's
   * own while this is true, rather than also backing out of Select. */
  const deleteAllConfirmOpen = (deps.dialogs ?? useDialogs()).flag('delete-all')

  /** Opens the Delete all confirmation modal (ticket 42); does nothing with no Project open. */
  function onRequestDeleteAll() {
    if (deps.currentProject()) {
      deleteAllConfirmOpen.value = true
    }
  }

  function onCancelDeleteAll() {
    deleteAllConfirmOpen.value = false
  }

  /** Confirms Delete all (ticket 42): resets grid and Row progress as one undo step. An exempt Edit: it ignores the
   * Row progress lock on purpose. */
  function onConfirmDeleteAll() {
    deleteAllConfirmOpen.value = false

    deps.edit('exempt', deleteAll)
  }

  return { deleteAllConfirmOpen, onRequestDeleteAll, onCancelDeleteAll, onConfirmDeleteAll }
}
