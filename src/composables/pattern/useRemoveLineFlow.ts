import { computed } from 'vue'
import type { MirrorAxisCounts } from '../../domain/mirror'
import type { Pattern, UndoEntry } from '../../domain/pattern'
import { removeLineRefusal, removeSelectedLine } from '../../domain/removeLine'
import type { Selection } from '../../domain/selection'

/** What Remove line needs from the app shell: the open Pattern, its write path, the history, and the session state it resets. */
export interface RemoveLineFlowDeps {
  currentPattern: () => Pattern | undefined
  replacePattern: (pattern: Pattern) => void
  /** useUndoHistory's record: one undo step for the state Remove line is about to replace. */
  recordHistory: (entry: UndoEntry) => void
  mirrorAxisCounts: () => MirrorAxisCounts
  clearMirrorAxisCounts: () => void
  selection: () => Selection | undefined
  /** Clears the Selection and the hover, both built against the old lines. */
  clearSelectionAndHover: () => void
}

/**
 * "Remove line" (tickets 123, 199; ADR 0023, ADR 0026): takes the selected whole row or column out of the Frame as one
 * undo step that carries the beads, Row progress and the old Frame, and resets the Selection and Mirror's axis counts,
 * which were built against the old lines. Refused while Row progress is on. Deps are read lazily.
 */
export function useRemoveLineFlow(deps: RemoveLineFlowDeps) {
  /** Whether Remove line applies right now: the Tools group's own enabled state. */
  const canRemoveSelectedLine = computed(() => {
    const pattern = deps.currentPattern()
    return !!pattern && !removeLineRefusal(pattern, deps.selection())
  })

  function onRemoveSelectedLine() {
    const pattern = deps.currentPattern()
    if (!pattern) {
      return
    }
    const updated = removeSelectedLine(pattern, deps.selection())
    if (updated === pattern) {
      return
    }

    deps.recordHistory({
      beads: pattern.beads,
      rowProgress: pattern.rowProgress,
      size: { frame: pattern.frame, mirrorAxisCounts: deps.mirrorAxisCounts() },
    })
    deps.replacePattern(updated)
    deps.clearMirrorAxisCounts()
    deps.clearSelectionAndHover()
  }

  return { canRemoveSelectedLine, onRemoveSelectedLine }
}
