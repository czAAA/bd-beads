import {
  moveToRow,
  rowProgressPosition,
  toggleRowDirection,
  type Project,
} from '../../domain/project'
import type { Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'

/** What the row-level operations need from the app shell: the open Project and its write path. */
export interface RowOpsDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  /** The success toast after the direction turns (ticket 411). */
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  messages: () => Translations
}

/**
 * The Row progress controls (tickets 32, 171, 201; ADR 0020). None of these is a grid edit, so none is an
 * undo step, and this composable has no dependency on history. Deps are read lazily.
 */
export function useRowOps(deps: RowOpsDeps) {
  /**
   * Flips row progress between running along the grid's rows and down its columns (ticket 32). Its own toggle,
   * separate from Rotate: turning the Project doesn't change which way the weaver's rows run. Not a grid edit, so not an
   * undo step.
   */
  function onToggleRowDirection() {
    const project = deps.currentProject()
    if (project) {
      const turned = toggleRowDirection(project)
      deps.replaceProject(turned)
      // Said once per change, whether the button or its key turned it (ticket 411).
      const t = deps.messages().rowProgress
      deps.showToast('row-direction', turned.rowProgress.direction === 'rows' ? t.directionToastRows : t.directionToastColumns, 'success')
    }
  }

  /** Steps the row pointer forward as a row is finished, or back to revisit an earlier one. */
  function onMoveRow(delta: number) {
    const project = deps.currentProject()
    if (project) {
      deps.replaceProject(moveToRow(project, rowProgressPosition(project).current + delta))
    }
  }

  return { onToggleRowDirection, onMoveRow }
}
