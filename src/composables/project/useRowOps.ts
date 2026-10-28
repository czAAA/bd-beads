import {
  moveToRow,
  resetRowProgress,
  rowProgressPosition,
  rowProgressStarted,
  toggleRowDirection,
  type Project,
} from '../../domain/project'
import type { Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What the row-level operations need from the app shell: the open Project and its write path. */
export interface RowOpsDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  /** The success toast after the direction turns (ticket 411). */
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  messages: () => Translations
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

/** The Row progress controls (tickets 32, 171, 201; ADR 0020): not grid edits, so no undo step and no dependency on
 * history. Deps are lazy. */
export function useRowOps(deps: RowOpsDeps) {
  /** Flips row progress between rows and columns (ticket 32): its own toggle, separate from Rotate, and not an undo
   * step. */
  function onToggleRowDirection() {
    const project = deps.currentProject()
    if (project) {
      const turned = toggleRowDirection(project)
      // A Technique woven in rows only has nothing to turn (ticket 487).
      if (turned === project) return
      deps.replaceProject(turned)
      // Said once per change, whether the button or its key turned it (ticket 411).
      const t = deps.messages().rowProgress
      const { direction, reversed } = turned.rowProgress
      const toast = {
        rows: reversed ? t.directionToastRowsReversed : t.directionToastRows,
        columns: reversed ? t.directionToastColumnsReversed : t.directionToastColumns,
      }[direction]
      deps.showToast('row-direction', toast, 'success')
    }
  }

  /** Steps the row pointer forward as a row is finished, or back to revisit an earlier one. */
  function onMoveRow(delta: number) {
    const project = deps.currentProject()
    if (project) {
      deps.replaceProject(moveToRow(project, rowProgressPosition(project).current + delta))
    }
  }

  /** Whether the Reset progress question is open (ticket 455): clearing every finished row is not an undo step, so
   * it asks first. */
  const resetProgressConfirmOpen = (deps.dialogs ?? useDialogs()).flag('reset-progress')

  /** Asks whether to reset; nothing to ask about until a row is done. */
  function onResetProgress() {
    const project = deps.currentProject()
    if (project && rowProgressStarted(project)) resetProgressConfirmOpen.value = true
  }

  /** The Reset progress question answered No: nothing changes. */
  function onCancelResetProgress() {
    resetProgressConfirmOpen.value = false
  }

  /** Reset progress after the question: the pointers go back to the first row, the direction stays. */
  function onConfirmResetProgress() {
    resetProgressConfirmOpen.value = false
    const project = deps.currentProject()
    if (project) deps.replaceProject(resetRowProgress(project))
  }

  return { onToggleRowDirection, onMoveRow, resetProgressConfirmOpen, onResetProgress, onCancelResetProgress, onConfirmResetProgress }
}
