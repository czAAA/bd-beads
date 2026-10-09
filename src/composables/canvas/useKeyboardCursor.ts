import { computed, ref } from 'vue'
import { beadBounds } from '../../domain/canvas'
import type { GridPosition } from '../../domain/grid'
import type { Project } from '../../domain/project'

/** What the keyboard cursor needs from the app shell. Deps are read lazily. */
export interface KeyboardCursorDeps {
  currentProject: () => Project | undefined
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
  /** Whether Set Frame is on: its arrows move the Frame, so the cursor stays hidden meanwhile (ticket 286). */
  settingFrame?: () => boolean
}

/**
 * Painting with the keyboard (tickets 159, 194; ADR 0020; BeadCursor card). The Project is one Tab stop with a bead
 * cursor: arrows move it, Shift + arrows extend a Selection, Home / End go to the row's ends, Page Up / Down move ten
 * rows, Space or Enter uses the current tool through the same handlers (and undo history) as a pointer press, and Escape
 * leaves. The cursor shows only after keyboard focus, and one polite announcement follows each action.
 */
export function useKeyboardCursor(deps: KeyboardCursorDeps) {
  const beadCursor = ref<GridPosition>({ row: 0, column: 0 })
  const keyboardOnProject = ref(false)
  /** The cursor is drawn only with keyboard focus on the Project, and not during Set Frame. */
  const cursorShown = computed(() => keyboardOnProject.value && !deps.settingFrame?.())
  let cursorProjectId: string | undefined

  /** Keyboard focus arriving on (or leaving) the Project. */
  function onProjectKeyboardFocus(focused: boolean) {
    keyboardOnProject.value = focused
    const project = deps.currentProject()
    if (focused && project) {
      // A new Project starts the cursor at the top-left of the Frame, or of what is drawn, or at the first bead.
      if (cursorProjectId !== project.id) {
        cursorProjectId = project.id
        const start = project.frame ?? beadBounds(project.beads)
        beadCursor.value = { row: start?.row ?? 0, column: start?.column ?? 0 }
      }
      // F focuses the Project for Set Frame's arrows: the cursor stays hidden, so nothing to reveal, hover or announce (ticket 286).
      if (deps.settingFrame?.()) return
      deps.reveal(beadCursor.value)
      deps.onCellHover(beadCursor.value.row, beadCursor.value.column)
      deps.announceCursor()
    } else {
      deps.finishExtending()
      deps.onHoverEnd()
    }
  }

    function moveCursor(row: number, column: number, extend: boolean) {
    const project = deps.currentProject()
    if (!project) return
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
  function rowEnds(project: Project, row: number): { first: number; last: number } {
    if (project.frame) {
      return { first: project.frame.column, last: project.frame.column + project.frame.columns - 1 }
    }
    const columns = Object.keys(project.beads[row] ?? {}).map(Number)
    return columns.length > 0
      ? { first: Math.min(...columns), last: Math.max(...columns) }
      : { first: beadCursor.value.column, last: beadCursor.value.column }
  }

  function onProjectKey(event: KeyboardEvent) {
    const { row, column } = beadCursor.value
    const project = deps.currentProject()
    if (!project) return
    if (deps.onFrameKey?.(event)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    // Rotated, the picture is turned clockwise: on-screen arrows move along whichever grid axis now points that way
    // (ticket 171) -- undoing the same turn gridToRegion's forward mapping applies to the picture itself.
    const turn = (dRow: number, dColumn: number): [number, number] => {
      switch (project.rotation) {
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
      moveCursor(row, rowEnds(project, row).first, false)
    } else if (event.key === 'End') {
      moveCursor(row, rowEnds(project, row).last, false)
    } else if (event.key === 'PageUp') {
      moveCursor(row - 10, column, false)
    } else if (event.key === 'PageDown') {
      moveCursor(row + 10, column, false)
    } else if (event.key === ' ' || event.key === 'Enter') {
      deps.invokeToolAt(beadCursor.value)
    } else if (event.key === 'Escape' && !deps.hasSelection()) {
      // Leaves the Project; with a Selection up, Escape clears that first (the app's own Escape order).
      ;(event.target as HTMLElement).blur()
    } else {
      return
    }
    // Handled here: Space doesn't pan, Enter doesn't mark a row done, the arrows don't scroll the box.
    event.preventDefault()
    event.stopPropagation()
  }

  function onProjectKeyUp(event: KeyboardEvent) {
    if (event.key === 'Shift') deps.finishExtending()
  }

  return { beadCursor, keyboardOnProject, cursorShown, onProjectKeyboardFocus, onProjectKey, onProjectKeyUp }
}
