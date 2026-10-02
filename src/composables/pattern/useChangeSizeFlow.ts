import { computed, ref } from 'vue'
import type { MirrorAxisCounts } from '../../domain/mirror'
import type { Pattern, UndoEntry } from '../../domain/pattern'
import { removeLineRefusal, removeSelectedLine, resizePattern, type ResizeRequest } from '../../domain/resize'
import type { Selection } from '../../domain/selection'

/** What a size change needs from the app shell: the open Pattern, its write path, the history, and the session state a size change resets. */
export interface ChangeSizeFlowDeps {
  currentPattern: () => Pattern | undefined
  replacePattern: (pattern: Pattern) => void
  /** useUndoHistory's record: one undo step for the state a size change is about to replace. */
  recordHistory: (entry: UndoEntry) => void
  mirrorAxisCounts: () => MirrorAxisCounts
  clearMirrorAxisCounts: () => void
  selection: () => Selection | undefined
  /** Clears the Selection and the hover, both built against the old size. */
  clearSelectionAndHover: () => void
}

/**
 * Resize, the Change size modal and "remove selected row/column" (tickets 123, 153, 199; ADR 0023): the three share
 * one undo-committing path, so they live together. Deps are read lazily.
 */
export function useChangeSizeFlow(deps: ChangeSizeFlowDeps) {
  /** Whether the Change size modal (ticket 153) is open. */
  const changeSizeOpen = ref(false)

  /**
   * Commits a command that changed the grid's own dimensions (Resize, or "remove selected row/column", ticket 123) as
   * one undo step carrying the grid, the dimensions and Row progress's pointers (which may have been clamped)
   * together. Neither is drawing, so neither goes through keepFinishedRows — both are instead refused outright while
   * Row progress is on (see resizeRefusal/removeLineRefusal). A no-op `updated` (refused, or changing nothing) is not
   * an undo step.
   *
   * A change to the grid's dimensions invalidates the editing-session state built against the old ones: the Selection
   * (which may now reach past the grid, or no longer name a whole line) and Mirror's axis counts (clamped to the old
   * size) are cleared, the same as Mirror's own docs say a Resize does. The clipboard survives, since a copied block
   * is colors, not a place.
   */
  function commitSizeChange(pattern: Pattern, updated: Pattern) {
    if (updated === pattern) {
      return
    }

    deps.recordHistory({
      grid: pattern.grid,
      rowProgress: pattern.rowProgress,
      size: { columns: pattern.columns, rows: pattern.rows, mirrorAxisCounts: deps.mirrorAxisCounts() },
    })
    deps.replacePattern(updated)
    deps.clearMirrorAxisCounts()
    deps.clearSelectionAndHover()
  }

  /** Resize (CONTEXT.md, ADR 0017) from the Size group: adds or removes rows and columns from either end (see commitSizeChange for what landing one does). */
  function onResize(request: ResizeRequest) {
    const pattern = deps.currentPattern()
    if (pattern) {
      commitSizeChange(pattern, resizePattern(pattern, request))
    }
  }

  /** Opens the Change size modal (ticket 153); refused under the same Row progress lock as Resize. */
  function onRequestChangeSize() {
    const pattern = deps.currentPattern()
    if (pattern && !pattern.rowProgress.enabled) {
      changeSizeOpen.value = true
    }
  }

  /** Confirming Change size is a Resize like any other: one undo step, Mirror's axis counts reset (see commitSizeChange). */
  function onConfirmChangeSize(request: ResizeRequest) {
    changeSizeOpen.value = false
    onResize(request)
  }

  /** Whether "remove selected row/column" (ticket 123) applies right now — the Tools group button's own enabled state. */
  const canRemoveSelectedLine = computed(() => {
    const pattern = deps.currentPattern()
    return !!pattern && !removeLineRefusal(pattern, deps.selection())
  })

  /**
   * "Remove selected row/column" (ticket 123): unlike Resize, this removes the specific line the Selection marks out
   * from any index, shifting the rest of the grid to close the gap (see commitSizeChange for what landing it does).
   */
  function onRemoveSelectedLine() {
    const pattern = deps.currentPattern()
    if (pattern) {
      commitSizeChange(pattern, removeSelectedLine(pattern, deps.selection()))
    }
  }

  return { changeSizeOpen, onResize, onRequestChangeSize, onConfirmChangeSize, canRemoveSelectedLine, onRemoveSelectedLine }
}
