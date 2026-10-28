import { computed, shallowRef } from 'vue'
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  emptyHistory,
  pushHistory,
  redoStep,
  undoStep,
  type History,
  type HistoryStep,
} from '../../domain/history'
import { snapshotOf, type Project, type UndoEntry } from '../../domain/project'

/** What the history needs from the app shell: the open Project and Edit's way of putting a snapshot back. */
export interface UndoHistoryDeps {
  currentProject: () => Project | undefined
  /** Edit's restore: writes the snapshot back and runs the session resets, without Edit's guards (ADR 0036). */
  restore: (snapshot: UndoEntry) => void
}

// Undo/redo (tickets 34, 48; ADRs 0023, 0036): stacks of full snapshots (domain/history.ts) pushed by Edit through
// record(); not saved with the Project, so the shell reset()s on a change. Deps are read lazily, so the shell can pass
// this and Edit to each other.
export function useUndoHistory(deps: UndoHistoryDeps) {
  // Shallow (ticket 0616): a step is replaced whole, and what Undo puts back must be the Project's own data, not a proxy.
  const history = shallowRef<History<UndoEntry>>(emptyHistory())

  const canUndo = computed(() => historyCanUndo(history.value))
  const canRedo = computed(() => historyCanRedo(history.value))

  /** Pushes one undo step: the state an Edit is about to replace. */
  function record(entry: UndoEntry) {
    history.value = pushHistory(history.value, entry)
  }

  function reset() {
    history.value = emptyHistory()
  }

  function applyHistoryStep(step: HistoryStep<UndoEntry>) {
    history.value = step.history
    deps.restore(step.snapshot)
  }

  function onUndo() {
    const project = deps.currentProject()
    const step = project && undoStep(history.value, snapshotOf(project))
    if (step) {
      applyHistoryStep(step)
    }
  }

  /** Re-applies whatever Undo most recently stepped back from (ticket 34); like Undo, replays history rather than
   * drawing, so it's not blocked by the Row progress lock. */
  function onRedo() {
    const project = deps.currentProject()
    const step = project && redoStep(history.value, snapshotOf(project))
    if (step) {
      applyHistoryStep(step)
    }
  }

  return { canUndo, canRedo, record, reset, onUndo, onRedo }
}
