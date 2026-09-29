import { ref } from 'vue'
import { CELL_SIZE_PX, GRID_BORDER_PX, type GridPosition } from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import { patternExtentPx, rowShiftPx, rowTopPx } from '../rendering/patternRenderer'

/** What the keyboard cursor needs from the app shell. Deps are read lazily. */
export interface KeyboardCursorDeps {
  currentPattern: () => Pattern | undefined
  zoom: () => number
  /** The canvas box that scrolls the Pattern. */
  scroller: () => HTMLElement | null
  hasSelection: () => boolean
  onCellHover: (row: number, column: number) => void
  onHoverEnd: () => void
  announceCursor: () => void
  invokeToolAt: (cursor: GridPosition) => void
  extendSelectionTo: (from: GridPosition, to: GridPosition) => void
  finishExtending: () => void
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

  /** Keyboard focus arriving on (or leaving) the Pattern. */
  function onPatternKeyboardFocus(focused: boolean) {
    keyboardOnPattern.value = focused
    const pattern = deps.currentPattern()
    if (focused && pattern) {
      beadCursor.value = {
        row: Math.min(beadCursor.value.row, pattern.rows - 1),
        column: Math.min(beadCursor.value.column, pattern.columns - 1),
      }
      deps.onCellHover(beadCursor.value.row, beadCursor.value.column)
      deps.announceCursor()
    } else {
      deps.finishExtending()
      deps.onHoverEnd()
    }
  }

  /** Keeps the cursor two beads from any edge of the visible part of the canvas box. */
  function keepCursorInView() {
    const pattern = deps.currentPattern()
    const scroller = deps.scroller()
    const surface = scroller?.querySelector<HTMLElement>('[data-testid="pattern-surface"]')
    if (!pattern || !scroller || !surface) return
    const zoom = deps.zoom()
    const { row, column } = beadCursor.value
    const extent = patternExtentPx(pattern.technique, pattern.columns, pattern.rows)
    const gridX = rowShiftPx(pattern.technique, row) + column * CELL_SIZE_PX
    const gridY = rowTopPx(pattern.technique, row)
    // Each quarter turn clockwise carries a bead's own top-left (x, y) to the turned picture's own top-left corner for
    // it, the same forward mapping patternRenderer's gridToRegion uses (composing it with itself for 180°/270°, ticket 171).
    const [x, y] = (() => {
      switch (pattern.rotation) {
        case 90:
          return [extent.height - gridY - CELL_SIZE_PX, gridX]
        case 180:
          return [extent.width - gridX - CELL_SIZE_PX, extent.height - gridY - CELL_SIZE_PX]
        case 270:
          return [gridY, extent.width - gridX - CELL_SIZE_PX]
        default:
          return [gridX, gridY]
      }
    })()
    const bead = CELL_SIZE_PX * zoom
    const margin = bead * 2
    const box = scroller.getBoundingClientRect()
    const origin = surface.getBoundingClientRect()
    const left = origin.left + (x + GRID_BORDER_PX) * zoom
    const top = origin.top + (y + GRID_BORDER_PX) * zoom
    if (left - margin < box.left) scroller.scrollLeft -= box.left - (left - margin)
    else if (left + bead + margin > box.right) scroller.scrollLeft += left + bead + margin - box.right
    if (top - margin < box.top) scroller.scrollTop -= box.top - (top - margin)
    else if (top + bead + margin > box.bottom) scroller.scrollTop += top + bead + margin - box.bottom
  }

  function moveCursor(row: number, column: number, extend: boolean) {
    const pattern = deps.currentPattern()
    if (!pattern) return
    const next = {
      row: Math.max(0, Math.min(pattern.rows - 1, row)),
      column: Math.max(0, Math.min(pattern.columns - 1, column)),
    }
    if (extend) {
      deps.extendSelectionTo(beadCursor.value, next)
    } else {
      deps.finishExtending()
    }
    beadCursor.value = next
    deps.onCellHover(next.row, next.column)
    keepCursorInView()
    deps.announceCursor()
  }

  function onPatternKey(event: KeyboardEvent) {
    const { row, column } = beadCursor.value
    const pattern = deps.currentPattern()
    if (!pattern) return
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
      moveCursor(row, 0, false)
    } else if (event.key === 'End') {
      moveCursor(row, pattern.columns - 1, false)
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
