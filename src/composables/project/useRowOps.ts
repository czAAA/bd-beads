import { shallowRef, watch, type ShallowRef } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { frameOf } from '../../domain/layerRecord'
import { moveToRow, resetRowProgress, rowProgressOf, rowProgressPosition, rowProgressStarted, shownWayOf, toggleRowDirection, turnRowDirectionTo, type ShownWay } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { rowProgressAnnouncement } from '../../i18n/rowProgressWords'
import type { Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What the row-level operations need from the app shell: the open Project and its write path. */
export interface RowOpsDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  /** The success toast after the direction turns (ticket 411), and the one saying a row marked done held a drawing. */
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  messages: () => Translations
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
  /** The announcer: each move of the row pointer is said in the counter's words (ticket 0934). */
  announce?: (text: string) => void
  /** Pans the Canvas the shortest way that brings the current row into view (ticket 0934). */
  showRow?: () => void
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

  /** Writes the Project with its rows turned another way, and says so: not an undo step (ticket 32). */
  function turnTo(turn: (project: Project) => Project) {
    const project = deps.currentProject()
    if (project) {
      const turned = turn(project)
      // A Technique woven in rows only has nothing to turn (ticket 487), and the way the rows run already turns nothing.
      if (turned === project) return
      stopRowMotion()
      deps.replaceProject(turned)
      // Said once per change, whether the list or the key turned it (ticket 411).
      const t = deps.messages().rowProgress
      // The Frame's own rows or columns, running the way they are seen, the Frame and the Canvas turned (ticket 1101).
      const toasts = {
        rows: { down: t.directionToastRows, up: t.directionToastRowsReversed, right: t.directionToastRowsLeftToRight, left: t.directionToastRowsRightToLeft },
        columns: { right: t.directionToastColumns, left: t.directionToastColumnsReversed, down: t.directionToastColumnsTopToBottom, up: t.directionToastColumnsBottomToTop },
      }
      const toast = toasts[rowProgressOf(turned).direction][shownWayOf(turned)]
      // The way left keeps its own pointer: said, so its rows marked done don't look lost (ticket 0849, F-04-04).
      const kept = rowProgressPosition(project).current > 0 ? (rowProgressOf(project).direction === 'columns' ? t.columnsKeptToast : t.rowsKeptToast) : undefined
      deps.showToast('row-direction', kept ? fillBlanks(t.directionKeptToast, { toast, kept }) : toast, 'success')
    }
  }

  /** The `D` key: the rows on to the next of the four ways (ticket 0589). */
  function onToggleRowDirection() {
    turnTo(toggleRowDirection)
  }

  /** A way chosen from Turn row direction's list (ticket 0973, UX-060): the rows run that way, its own count back. */
  function onSetRowDirection(way: ShownWay) {
    turnTo((project) => turnRowDirectionTo(project, way))
  }

  /** Points the row pointer at a pass: a press of Row done or Row not done (`pressed`), or Go to row's jump. The row it
   * reaches is brought into view and said aloud (ticket 0934). */
  function moveTo(pass: (from: number) => number, pressed: boolean) {
    const project = deps.currentProject()
    if (!project) return
    const { current: from, total } = rowProgressPosition(project)
    const moved = moveToRow(project, pass(from))
    const to = rowProgressPosition(moved).current
    if (to === from) return
    // Said before the write, so the surface that redraws for it already knows the press. A jump plays nothing.
    if (pressed) rowPress.value = { id: ++presses, done: to > from, from, to, patternDone: to === total }
    else stopRowMotion()
    deps.replaceProject(moved)
    deps.showRow?.()
    deps.announce?.(rowProgressAnnouncement(deps.messages().rowProgress, moved))
  }

  /** Steps the row pointer forward as a row is finished, or back to revisit an earlier one. */
  function onMoveRow(delta: number) {
    moveTo((from) => from + delta, true)
  }

  /** Go to row (ticket 0849, F-04-14): the pointer straight to a pass, zero-based, for a weaver who started from a
   * printed chart; every pass before it is then marked done. Not an undo step, as Row done isn't. */
  function onGoToRow(pass: number) {
    moveTo(() => pass, false)
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

  /** Says why a drawing did not land: rows marked done took it back (ticket 0848). One toast, replaced, not stacked. */
  function tellMarkedDone(project: Project) {
    const t = deps.messages().rowProgress
    deps.showToast('marked-done', rowProgressOf(project).direction === 'columns' ? t.columnMarkedDoneToast : t.markedDoneToast, 'info')
  }

  return { rowPress, stopRowMotion, tellMarkedDone, onToggleRowDirection, onSetRowDirection, onMoveRow, onGoToRow, resetProgressConfirmOpen, onResetProgress, onCancelResetProgress, onConfirmResetProgress }
}
