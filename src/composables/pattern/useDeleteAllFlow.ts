import { ref } from 'vue'
import { deleteAll, type Pattern, type UndoEntry } from '../../domain/pattern'

/** What Delete all needs from the app shell: the open Pattern, its one write path, and the history's record. */
export interface DeleteAllFlowDeps {
  currentPattern: () => Pattern | undefined
  replacePattern: (pattern: Pattern) => void
  /** useUndoHistory's record: one undo step for the state Delete all is about to replace. */
  recordHistory: (entry: UndoEntry) => void
}

/** Delete all and its confirmation modal (ticket 42, 198; ADR 0023). Deps are read lazily. */
export function useDeleteAllFlow(deps: DeleteAllFlowDeps) {
  /** Whether the Delete all confirmation modal (ticket 42) is open. The global Escape handler defers to the modal's own while this is true, rather than also backing out of Select. */
  const deleteAllConfirmOpen = ref(false)

  /** Opens the Delete all confirmation modal (ticket 42); does nothing with no Pattern open. */
  function onRequestDeleteAll() {
    if (deps.currentPattern()) {
      deleteAllConfirmOpen.value = true
    }
  }

  function onCancelDeleteAll() {
    deleteAllConfirmOpen.value = false
  }

  /**
   * Confirms Delete all (ticket 42): resets the grid and Row progress together as a single undo step. Applied
   * directly rather than through commitGridChange/keepFinishedRows, since Delete all ignores the Row progress lock
   * on purpose — clearing progress is the point.
   */
  function onConfirmDeleteAll() {
    deleteAllConfirmOpen.value = false

    const pattern = deps.currentPattern()
    if (!pattern) {
      return
    }

    const updated = deleteAll(pattern)
    if (updated === pattern) {
      return
    }

    deps.recordHistory({ grid: pattern.grid, rowProgress: pattern.rowProgress })
    deps.replacePattern(updated)
  }

  return { deleteAllConfirmOpen, onRequestDeleteAll, onCancelDeleteAll, onConfirmDeleteAll }
}
