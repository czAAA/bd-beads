import {
  moveToRow,
  rowProgressPosition,
  setRowProgressEnabled,
  toggleRowDirection,
  type Project,
} from '../../domain/project'

/** What the row-level operations need from the app shell: the open Project and its write path. */
export interface RowOpsDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
}

/**
 * The Row progress controls (tickets 32, 171, 201; ADR 0020). None of these is a grid edit, so none is an
 * undo step, and this composable has no dependency on history. Deps are read lazily.
 */
export function useRowOps(deps: RowOpsDeps) {
  function onToggleRowProgress(enabled: boolean) {
    const project = deps.currentProject()
    if (project) {
      deps.replaceProject(setRowProgressEnabled(project, enabled))
    }
  }

  /**
   * Flips row progress between running along the grid's rows and down its columns (ticket 32). Its own toggle,
   * separate from Rotate: turning the Project doesn't change which way the weaver's rows run. Not a grid edit, so not an
   * undo step.
   */
  function onToggleRowDirection() {
    const project = deps.currentProject()
    if (project) {
      deps.replaceProject(toggleRowDirection(project))
    }
  }

  /** Steps the row pointer forward as a row is finished, or back to revisit an earlier one. */
  function onMoveRow(delta: number) {
    const project = deps.currentProject()
    if (project) {
      deps.replaceProject(moveToRow(project, rowProgressPosition(project).current + delta))
    }
  }

  return { onToggleRowProgress, onToggleRowDirection, onMoveRow }
}
