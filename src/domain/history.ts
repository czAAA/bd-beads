/**
 * The undo/redo stacks for an editing session (ticket 34). Generic over the snapshot type rather than tied to a
 * Pattern's Grid, since nothing here cares what it's a history of — App.vue is the one that decides what counts as
 * a step and pushes Grid snapshots. Like the undo stack it replaced, this is an editing-session aid: never saved
 * with the Pattern, and reset (via emptyHistory) whenever the open Pattern changes.
 */
export interface History<T> {
  readonly undoStack: readonly T[]
  readonly redoStack: readonly T[]
}

export function emptyHistory<T>(): History<T> {
  return { undoStack: [], redoStack: [] }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.undoStack.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.redoStack.length > 0
}

/**
 * Records `snapshot` — the state a step-worthy edit started from — as a step Undo can come back to, and clears
 * whatever was available to Redo: a fresh edit invalidates the steps Redo used to reach (ticket 34's decision).
 * Call this only for an edit that actually changed something; an edit that landed on nothing isn't a step and must
 * leave Redo alone, which is why this always clears rather than leaving that judgment to the caller.
 */
export function pushHistory<T>(history: History<T>, snapshot: T): History<T> {
  return { undoStack: [...history.undoStack, snapshot], redoStack: [] }
}

export interface HistoryStep<T> {
  history: History<T>
  /** The snapshot to restore. */
  snapshot: T
}

/** Steps back to the most recently pushed snapshot, if there is one, recording `current` on the redo stack so Redo can step forward to it again. */
export function undoStep<T>(history: History<T>, current: T): HistoryStep<T> | undefined {
  const snapshot = history.undoStack.at(-1)
  if (snapshot === undefined) {
    return undefined
  }

  return {
    snapshot,
    history: { undoStack: history.undoStack.slice(0, -1), redoStack: [...history.redoStack, current] },
  }
}

/** Steps forward to the snapshot the most recent undo stepped back from, if there is one, recording `current` back on the undo stack. */
export function redoStep<T>(history: History<T>, current: T): HistoryStep<T> | undefined {
  const snapshot = history.redoStack.at(-1)
  if (snapshot === undefined) {
    return undefined
  }

  return {
    snapshot,
    history: { undoStack: [...history.undoStack, current], redoStack: history.redoStack.slice(0, -1) },
  }
}
