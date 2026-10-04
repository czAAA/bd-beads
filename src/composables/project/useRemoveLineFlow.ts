import { computed } from 'vue'
import type { MirrorAxisCounts } from '../../domain/mirror'
import type { Project, UndoEntry } from '../../domain/project'
import { removeLineRefusal, removeSelectedLine } from '../../domain/removeLine'
import type { Selection } from '../../domain/selection'

/** What Remove line needs from the app shell: the open Project, its write path, the history, and the session state it resets. */
export interface RemoveLineFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
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
    const project = deps.currentProject()
    return !!project && !removeLineRefusal(project, deps.selection())
  })

  function onRemoveSelectedLine() {
    const project = deps.currentProject()
    if (!project) {
      return
    }
    const updated = removeSelectedLine(project, deps.selection())
    if (updated === project) {
      return
    }

    deps.recordHistory({
      beads: project.beads,
      rowProgress: project.rowProgress,
      size: { frame: project.frame, mirrorAxisCounts: deps.mirrorAxisCounts() },
    })
    deps.replaceProject(updated)
    deps.clearMirrorAxisCounts()
    deps.clearSelectionAndHover()
  }

  return { canRemoveSelectedLine, onRemoveSelectedLine }
}
