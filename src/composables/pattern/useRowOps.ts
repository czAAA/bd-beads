import {
  moveToRow,
  rowProgressPosition,
  setRowProgressEnabled,
  toggleRotated,
  toggleRowDirection,
  type Pattern,
} from '../../domain/pattern'

/** What the row-level operations need from the app shell: the open Pattern, its write path, and the zoom refit. */
export interface RowOpsDeps {
  currentPattern: () => Pattern | undefined
  replacePattern: (pattern: Pattern) => void
  resetZoom: () => void
}

/**
 * Rotate and the Row progress controls (tickets 32, 171, 201; ADR 0023). None of these is a grid edit, so none is an
 * undo step, and this composable has no dependency on history. Deps are read lazily.
 */
export function useRowOps(deps: RowOpsDeps) {
  /**
   * Steps the Pattern's rotation one quarter turn clockwise (see Pattern.rotation, ticket 171) — a purely visual
   * turn, not a grid edit, so it doesn't go through commitGridChange/undo. Still refits the zoom, since the on-screen
   * footprint swaps at 90°/270° (it's unchanged at 180°, but refitting either way is harmless).
   */
  function onToggleRotate() {
    const pattern = deps.currentPattern()
    if (!pattern) {
      return
    }

    deps.replacePattern(toggleRotated(pattern))
    deps.resetZoom()
  }

  function onToggleRowProgress(enabled: boolean) {
    const pattern = deps.currentPattern()
    if (pattern) {
      deps.replacePattern(setRowProgressEnabled(pattern, enabled))
    }
  }

  /**
   * Flips row progress between running along the grid's rows and down its columns (ticket 32). Its own toggle,
   * separate from Rotate: rotating only turns the picture, and neither ever changes the other. Like Rotate, not a grid
   * edit, so not an undo step.
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

  return { onToggleRotate, onToggleRowProgress, onToggleRowDirection, onMoveRow }
}
