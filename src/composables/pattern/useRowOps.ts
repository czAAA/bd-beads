import {
  moveToRow,
  rowProgressPosition,
  setRowProgressEnabled,
  toggleRowDirection,
  type Pattern,
} from '../../domain/pattern'

/** What the row-level operations need from the app shell: the open Pattern and its write path. */
export interface RowOpsDeps {
  currentPattern: () => Pattern | undefined
  replacePattern: (pattern: Pattern) => void
}

/**
 * The Row progress controls (tickets 32, 171, 201; ADR 0023). None of these is a grid edit, so none is an
 * undo step, and this composable has no dependency on history. Deps are read lazily.
 */
export function useRowOps(deps: RowOpsDeps) {
  function onToggleRowProgress(enabled: boolean) {
    const pattern = deps.currentPattern()
    if (pattern) {
      deps.replacePattern(setRowProgressEnabled(pattern, enabled))
    }
  }

  /**
   * Flips row progress between running along the grid's rows and down its columns (ticket 32). Its own toggle,
   * separate from Rotate: turning the Pattern doesn't change which way the weaver's rows run. Not a grid edit, so not an
   * undo step.
   */
  function onToggleRowDirection() {
    const pattern = deps.currentPattern()
    if (pattern) {
      deps.replacePattern(toggleRowDirection(pattern))
    }
  }

  /** Steps the row pointer forward as a row is finished, or back to revisit an earlier one. */
  function onMoveRow(delta: number) {
    const pattern = deps.currentPattern()
    if (pattern) {
      deps.replacePattern(moveToRow(pattern, rowProgressPosition(pattern).current + delta))
    }
  }

  return { onToggleRowProgress, onToggleRowDirection, onMoveRow }
}
