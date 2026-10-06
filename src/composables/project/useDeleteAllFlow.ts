import { ref } from 'vue'
import { deleteAll, type Project } from '../../domain/project'
import type { EditFn } from './useEdit'

/** What Delete all needs from the app shell: the open Project and Edit. */
export interface DeleteAllFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
}

/** Delete all and its confirmation modal (ticket 42, 198; ADR 0023). Deps are read lazily. */
export function useDeleteAllFlow(deps: DeleteAllFlowDeps) {
  /** Whether the Delete all confirmation modal (ticket 42) is open. The global Escape handler defers to the modal's own while this is true, rather than also backing out of Select. */
  const deleteAllConfirmOpen = ref(false)

  /** Opens the Delete all confirmation modal (ticket 42); does nothing with no Project open. */
  function onRequestDeleteAll() {
    if (deps.currentProject()) {
      deleteAllConfirmOpen.value = true
    }
  }

  function onCancelDeleteAll() {
    deleteAllConfirmOpen.value = false
  }

  /**
   * Confirms Delete all (ticket 42): resets the grid and Row progress together as a single undo step. An exempt
   * Edit, since Delete all ignores the Row progress lock on purpose — clearing progress is the point.
   */
  function onConfirmDeleteAll() {
    deleteAllConfirmOpen.value = false

    deps.edit('exempt', deleteAll)
  }

  return { deleteAllConfirmOpen, onRequestDeleteAll, onCancelDeleteAll, onConfirmDeleteAll }
}
