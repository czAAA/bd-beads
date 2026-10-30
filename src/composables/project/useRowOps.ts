import { shallowRef, watch, type ShallowRef } from 'vue'
import { frameOf } from '../../domain/layerRecord'
import { moveToRow, resetRowProgress, rowProgressOf, rowProgressPosition, rowProgressStarted, toggleRowDirection } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
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

/** A press of Row done or Row not done that moved the pointer (ticket 0730): what the Pattern's motion plays from.
 * Opening a Project, Undo, Redo and Reset progress move the pointer too, and play nothing. */
export interface RowPress {
  /** Tells this press from the one before. */
  id: number
  /** Row done, or Row not done. */
  done: boolean
  /** The pass it left and the one it reached, in the Row direction it was pressed in. */
  from: number
  to: number
  /** Whether it marked the last pass: Pattern done plays once. */
  patternDone: boolean
}

/** The Row progress controls (tickets 32, 171, 201; ADR 0020): not grid edits, so no undo step and no dependency on
 * history. Deps are lazy. */
export function useRowOps(deps: RowOpsDeps) {
  /** The last press, until something stops its motion (ticket 0730). */
  const rowPress: ShallowRef<RowPress | undefined> = shallowRef()
  let presses = 0

  /** Stops the Pattern's motion at once: Reset progress, a turn of the direction, Undo or Redo (ticket 0730). */
  function stopRowMotion() {
    rowPress.value = undefined
  }
  // Remove Frame and leaving the Project stop it too, however they come about.
  watch([() => deps.currentProject()?.id, () => frameOf(deps.currentProject()) !== undefined], stopRowMotion)

  /** Flips row progress between rows and columns (ticket 32): its own toggle, separate from Rotate, and not an undo
   * step. */
  function onToggleRowDirection() {
    const project = deps.currentProject()
    if (project) {
      const turned = toggleRowDirection(project)
      // A Technique woven in rows only has nothing to turn (ticket 487).
      if (turned === project) return
      stopRowMotion()
      deps.replaceProject(turned)
      // Said once per change, whether the button or its key turned it (ticket 411).
      const t = deps.messages().rowProgress
      const { direction, reversed } = rowProgressOf(turned)
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
    if (!project) return
    const { current: from, total } = rowProgressPosition(project)
    const moved = moveToRow(project, from + delta)
    const to = rowProgressPosition(moved).current
    if (to === from) return
    // Said before the write, so the surface that redraws for it already knows the press.
    rowPress.value = { id: ++presses, done: to > from, from, to, patternDone: to === total }
    deps.replaceProject(moved)
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
    stopRowMotion()
    if (project) deps.replaceProject(resetRowProgress(project))
  }

  return { rowPress, stopRowMotion, onToggleRowDirection, onMoveRow, resetProgressConfirmOpen, onResetProgress, onCancelResetProgress, onConfirmResetProgress }
}
