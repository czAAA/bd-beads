/** The undo/redo stacks for an editing session (ticket 34), generic over the snapshot type. Never saved with the
 * Project; reset (emptyHistory) when the open Project changes; App.vue decides what counts as a step. */
export interface History<T> {
  readonly undoStack: readonly T[]
  readonly redoStack: readonly T[]
  /** Under a cap (ticket 0677), each Undo step's estimated size but the newest's, oldest first: a step's size is
   * measured against the step after it, so the newest's is measured once another is pushed on it. */
  readonly undoSizes: readonly number[]
}

/** How much memory the Undo steps may hold together (ticket 0677); past it, the oldest are dropped. */
export interface HistoryCap<T> {
  /** The estimated bytes all the Undo steps may hold. */
  bytes: number
  /** About how many bytes `older` holds that `newer`, the step after it, does not share. */
  sizeOf: (older: T, newer: T) => number
}

export function emptyHistory<T>(): History<T> {
  return { undoStack: [], redoStack: [], undoSizes: [] }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.undoStack.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.redoStack.length > 0
}

/** The Undo stack with `snapshot` on top, and the oldest steps dropped while their sizes pass the cap; the newest step
 * is always kept. */
function onUndoStack<T>(history: History<T>, snapshot: T, cap: HistoryCap<T> | undefined): Pick<History<T>, 'undoStack' | 'undoSizes'> {
  const below = history.undoStack.at(-1)
  if (!cap || below === undefined) {
    return { undoStack: [...history.undoStack, snapshot], undoSizes: history.undoSizes }
  }
  const sizes = [...history.undoSizes, cap.sizeOf(below, snapshot)]
  let total = sizes.reduce((sum, size) => sum + size, 0)
  let dropped = 0
  while (total > cap.bytes && dropped < sizes.length) {
    total -= sizes[dropped]!
    dropped += 1
  }
  return { undoStack: [...history.undoStack.slice(dropped), snapshot], undoSizes: sizes.slice(dropped) }
}

/** Records `snapshot` (the state a step-worthy edit started from) as an Undo step and clears Redo (ticket 34); under a
 * cap, the oldest steps go once the steps hold too much (ticket 0677). Call only for an edit that changed something: a
 * no-op edit isn't a step and must leave Redo alone. */
export function pushHistory<T>(history: History<T>, snapshot: T, cap?: HistoryCap<T>): History<T> {
  return { ...onUndoStack(history, snapshot, cap), redoStack: [] }
}

export interface HistoryStep<T> {
  history: History<T>
  /** The snapshot to restore. */
  snapshot: T
}

/** Steps back to the most recently pushed snapshot, if there is one, recording `current` on the redo stack so Redo
 * can step forward to it again. */
export function undoStep<T>(history: History<T>, current: T): HistoryStep<T> | undefined {
  const snapshot = history.undoStack.at(-1)
  if (snapshot === undefined) {
    return undefined
  }

  return {
    snapshot,
    history: { undoStack: history.undoStack.slice(0, -1), undoSizes: history.undoSizes.slice(0, -1), redoStack: [...history.redoStack, current] },
  }
}

/** Steps forward to the snapshot the most recent undo stepped back from, if there is one, recording `current` back
 * on the undo stack, under the cap as a pushed step is. */
export function redoStep<T>(history: History<T>, current: T, cap?: HistoryCap<T>): HistoryStep<T> | undefined {
  const snapshot = history.redoStack.at(-1)
  if (snapshot === undefined) {
    return undefined
  }

  return {
    snapshot,
    history: { ...onUndoStack(history, current, cap), redoStack: history.redoStack.slice(0, -1) },
  }
}
