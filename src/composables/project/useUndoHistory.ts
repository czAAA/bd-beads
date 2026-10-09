import { computed, ref } from 'vue'
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
import type { MirrorAxisCounts } from '../../domain/mirror'
import { snapshotOf, type Project, type UndoEntry } from '../../domain/project'

/** What the history needs from the app shell: the open Project, Mirror's live axis counts, and Edit's way of putting a snapshot back. */
export interface UndoHistoryDeps {
  currentProject: () => Project | undefined
  /** Mirror's live axis counts, recorded with the snapshot of the current state so a Redo/Undo through it round-trips (ADR 0036). */
  mirrorAxisCounts: () => MirrorAxisCounts
  /** Edit's restore: writes the snapshot back and runs the session resets, without Edit's guards (ADR 0036). */
  restore: (snapshot: UndoEntry) => void
}

/**
 * Undo/redo (tickets 34, 48; ADRs 0023, 0036): the stacks of snapshots (see domain/history.ts) and the Undo and Redo
 * steps through them. Every entry is a full snapshot, pushed by Edit through record(). It's an editing-session aid, not
 * part of the saved Project, so the app shell calls reset() whenever the open Project changes.
 *
 * Deps are read lazily (at call time), so the shell can pass this and Edit to each other.
 */
export function useUndoHistory(deps: UndoHistoryDeps) {
  const history = ref<History<UndoEntry>>(emptyHistory())

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
    const step = project && undoStep(history.value, snapshotOf(project, deps.mirrorAxisCounts()))
    if (step) {
      applyHistoryStep(step)
    }
  }

  /** Re-applies whatever Undo most recently stepped back from (ticket 34); like Undo, replays history rather than drawing, so it's not blocked by the Row progress lock. */
  function onRedo() {
    const project = deps.currentProject()
    const step = project && redoStep(history.value, snapshotOf(project, deps.mirrorAxisCounts()))
    if (step) {
      applyHistoryStep(step)
    }
  }

  return { canUndo, canRedo, record, reset, onUndo, onRedo }
}
