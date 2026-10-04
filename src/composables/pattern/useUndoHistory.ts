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
import { sameFrame } from '../../domain/frame'
import type { MirrorAxisCounts } from '../../domain/mirror'
import { keepAllowedEdits } from '../../domain/margin'
import { restoreSnapshot, type Pattern, type UndoEntry } from '../../domain/pattern'

/** What the history needs from the app shell: the open Pattern and its one write path, plus the session state a step can also touch. */
export interface UndoHistoryDeps {
  currentPattern: () => Pattern | undefined
  replacePattern: (pattern: Pattern) => void
  /** Mirror's live axis counts, recorded with a snapshot so a Redo/Undo through it round-trips (ADR 0017). */
  mirrorAxisCounts: () => MirrorAxisCounts
  restoreMirrorAxisCounts: (counts: MirrorAxisCounts) => void
  /** Clears a Selection (or hover) that no longer fits after a step changed the grid's size. */
  clearSelectionAndHover: () => void
}

/**
 * Undo/redo (tickets 34, 48; ADR 0023): the stacks of snapshots (see domain/history.ts), `commitGridChange` for
 * grid-changing commands, and the shared apply/step logic behind Undo and Redo. It's an editing-session aid, not part
 * of the saved Pattern, so the app shell calls reset() whenever the open Pattern changes. Each entry carries a grid,
 * plus whatever else the command also changed: Row progress, the Bead, and the grid size with Mirror's axis counts
 * — see UndoEntry.
 *
 * Deps are read lazily (at call time), so the shell can pass this and useMirrorState to each other.
 */
export function useUndoHistory(deps: UndoHistoryDeps) {
  const history = ref<History<UndoEntry>>(emptyHistory())

  const canUndo = computed(() => historyCanUndo(history.value))
  const canRedo = computed(() => historyCanRedo(history.value))

  /** Pushes one undo step: the state a command is about to replace, carrying only what it changes. */
  function record(entry: UndoEntry) {
    history.value = pushHistory(history.value, entry)
  }

  function reset() {
    history.value = emptyHistory()
  }

  /**
   * Commits the result of a grid-changing command (fill/mirror/paste) as one undo step, minus anything it did to rows
   * already woven (ticket 33) or painted in the Frame's margin (ticket 261), unless that leaves the Pattern unchanged.
   */
  function commitGridChange(pattern: Pattern, updated: Pattern) {
    const kept = keepAllowedEdits(pattern, updated)
    if (kept === pattern) {
      return
    }

    record({ beads: pattern.beads })
    deps.replacePattern(kept)
  }

  /**
   * Everything Undo/Redo can step through right now, fully populated (ticket 48): the grid, Row progress, the Bead, and
   * the grid size with Mirror's axis counts. Every other command's own record() call only carries what it actually
   * changed, but the snapshot recorded here — of the *current* state, as the opposite stack's new top — has to be
   * complete so a later Redo/Undo through it round-trips exactly, even for fields this particular step left untouched.
   */
  function currentUndoEntry(pattern: Pattern): UndoEntry {
    return {
      beads: pattern.beads,
      rowProgress: pattern.rowProgress,
      beadId: pattern.beadId,
      size: {
        frame: pattern.frame,
        mirrorAxisCounts: deps.mirrorAxisCounts(),
      },
    }
  }

  /**
   * Applies one Undo/Redo step, shared by both directions: the grid/Row progress/Bead/size the snapshot carries (via
   * restoreSnapshot), plus what isn't a Pattern field and so can't ride along in it — Mirror's axis counts, and clearing
   * a Selection (or hover) that no longer fits when the step changed the grid's size.
   */
  function applyHistoryStep(pattern: Pattern, step: HistoryStep<UndoEntry>) {
    history.value = step.history
    deps.replacePattern(restoreSnapshot(pattern, step.snapshot))

    const { size } = step.snapshot
    if (size) {
      deps.restoreMirrorAxisCounts(size.mirrorAxisCounts)
      if (!sameFrame(size.frame, pattern.frame)) {
        deps.clearSelectionAndHover()
      }
    }
  }

  function onUndo() {
    const pattern = deps.currentPattern()
    const step = pattern && undoStep(history.value, currentUndoEntry(pattern))
    if (!step) {
      return
    }

    applyHistoryStep(pattern, step)
  }

  /** Re-applies whatever Undo most recently stepped back from (ticket 34); like Undo, replays history rather than drawing, so it's not blocked by the Row progress lock. */
  function onRedo() {
    const pattern = deps.currentPattern()
    const step = pattern && redoStep(history.value, currentUndoEntry(pattern))
    if (!step) {
      return
    }

    applyHistoryStep(pattern, step)
  }

  return { canUndo, canRedo, record, reset, commitGridChange, applyHistoryStep, onUndo, onRedo }
}
