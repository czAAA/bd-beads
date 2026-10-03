import { ref } from 'vue'
import { beadBounds } from '../../domain/canvas'
import type { GridPosition } from '../../domain/grid'
import type { Pattern } from '../../domain/pattern'

/** What the keyboard cursor needs from the app shell. Deps are read lazily. */
export interface KeyboardCursorDeps {
  currentPattern: () => Pattern | undefined
  /** Scrolls the open canvas just far enough to show a bead (the cursor never leaves the view). */
  reveal: (position: GridPosition) => void
  hasSelection: () => boolean
  onCellHover: (row: number, column: number) => void
  onHoverEnd: () => void
  announceCursor: () => void
  invokeToolAt: (cursor: GridPosition) => void
  extendSelectionTo: (from: GridPosition, to: GridPosition) => void
  finishExtending: () => void
  /** Set Frame's keys (arrows, Enter, Escape): true when it used the key. */
  onFrameKey?: (event: KeyboardEvent) => boolean
}

/**
 * Painting with the keyboard (tickets 159, 194; ADR 0023; BeadCursor card). The Pattern is one Tab stop with a bead
 * cursor: arrows move it, Shift + arrows extend a Selection, Home / End go to the row's ends, Page Up / Down move ten
 * rows, Space or Enter uses the current tool through the same handlers (and undo history) as a pointer press, and Escape
 * leaves. The cursor shows only after keyboard focus, and one polite announcement follows each action.
 */
export function useKeyboardCursor(deps: KeyboardCursorDeps) {
  const beadCursor = ref<GridPosition>({ row: 0, column: 0 })
  const keyboardOnPattern = ref(false)
  let cursorPatternId: string | undefined

  /** Keyboard focus arriving on (or leaving) the Pattern. */
  function onPatternKeyboardFocus(focused: boolean) {
    keyboardOnPattern.value = focused
    const pattern = deps.currentPattern()
    if (focused && pattern) {
      // A new Pattern starts the cursor at the top-left of the Frame, or of what is drawn, or at the first bead.
      if (cursorPatternId !== pattern.id) {
        cursorPatternId = pattern.id
        const start = pattern.frame ?? beadBounds(pattern.beads)
        beadCursor.value = { row: start?.row ?? 0, column: start?.column ?? 0 }
      }
      deps.reveal(beadCursor.value)
      deps.onCellHover(beadCursor.value.row, beadCursor.value.column)
      deps.announceCursor()
    } else {
      deps.finishExtending()
      deps.onHoverEnd()
    }
  }

    function moveCursor(row: number, column: number, extend: boolean) {
    const pattern = deps.currentPattern()
    if (!pattern) return
    const next = { row, column }
    if (extend) {
      deps.extendSelectionTo(beadCursor.value, next)
    } else {
      deps.finishExtending()
    }
    beadCursor.value = next
    deps.onCellHover(next.row, next.column)
    deps.reveal(next)
    deps.announceCursor()
  }

  /** Where a row begins and ends for Home and End: across the Frame when there is one, otherwise from its first bead to its last (the cursor stays put on an empty row). */
  function rowEnds(pattern: Pattern, row: number): { first: number; last: number } {
    if (pattern.frame) {
      return { first: pattern.frame.column, last: pattern.frame.column + pattern.frame.columns - 1 }
    }
    const columns = Object.keys(pattern.beads[row] ?? {}).map(Number)
    return columns.length > 0
      ? { first: Math.min(...columns), last: Math.max(...columns) }
      : { first: beadCursor.value.column, last: beadCursor.value.column }
  }

  function onPatternKey(event: KeyboardEvent) {
    const { row, column } = beadCursor.value
    const pattern = deps.currentPattern()
    if (!pattern) return
    if (deps.onFrameKey?.(event)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    // Rotated, the picture is turned clockwise: on-screen arrows move along whichever grid axis now points that way
    // (ticket 171) -- undoing the same turn gridToRegion's forward mapping applies to the picture itself.
    const turn = (dRow: number, dColumn: number): [number, number] => {
      switch (pattern.rotation) {
        case 90:
          return [-dColumn, dRow]
        case 180:
          return [-dRow, -dColumn]
        case 270:
          return [dColumn, -dRow]
        default:
          return [dRow, dColumn]
      }
    }
    const steps: Record<string, [number, number]> = {
      ArrowUp: turn(-1, 0),
      ArrowDown: turn(1, 0),
      ArrowLeft: turn(0, -1),
      ArrowRight: turn(0, 1),
    }
    const step = steps[event.key]
    if (step) {
      moveCursor(row + step[0], column + step[1], event.shiftKey)
    } else if (event.key === 'Home') {
      moveCursor(row, rowEnds(pattern, row).first, false)
    } else if (event.key === 'End') {
      moveCursor(row, rowEnds(pattern, row).last, false)
    } else if (event.key === 'PageUp') {
      moveCursor(row - 10, column, false)
    } else if (event.key === 'PageDown') {
      moveCursor(row + 10, column, false)
    } else if (event.key === ' ' || event.key === 'Enter') {
      deps.invokeToolAt(beadCursor.value)
    } else if (event.key === 'Escape' && !deps.hasSelection()) {
      // Leaves the Pattern; with a Selection up, Escape clears that first (the app's own Escape order).
      ;(event.target as HTMLElement).blur()
    } else {
      return
    }
    // Handled here: Space doesn't pan, Enter doesn't mark a row done, the arrows don't scroll the box.
    event.preventDefault()
    event.stopPropagation()
  }

  function onPatternKeyUp(event: KeyboardEvent) {
    if (event.key === 'Shift') deps.finishExtending()
  }

  return { beadCursor, keyboardOnPattern, onPatternKeyboardFocus, onPatternKey, onPatternKeyUp }
}
