import type { GridPosition } from '../../domain/grid'
import type { Project } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import type { Translations } from '../../i18n/translations'

/** What invoking a tool at a cursor needs from the app shell. Deps are read lazily. */
export interface ToolAtCursorDeps {
  messages: () => Translations
  currentProject: () => Project | undefined
  activeTool: () => Tool
  selectedColorHex: () => string | null
  /** The pointer-press handler for the active tool on a bead. */
  pressCell: (row: number, column: number) => void
  /** Ends the stroke a press began (the pointer release). */
  endStroke: () => void
  beginSelectPress: (row: number, column: number) => void
  extendSelection: (row: number, column: number) => void
  announce: (text: string) => void
  colorWords: (hex: string | null | undefined) => string
}

/**
 * The active tool at a cursor position (tickets 159, 193; ADR 0023): one press and release, and a Selection stretched
 * from the bead the cursor was on. Kept apart from keyboard navigation so other cursor sources (touch) can use it.
 */
export function useToolAtCursor(deps: ToolAtCursorDeps) {
  /** Whether a Selection is being stretched, begun at the bead the cursor was on. */
  let extending = false

  /** The current tool on the bead at `cursor`, through the same handlers as a pointer press and release. */
  function invokeToolAt(cursor: GridPosition) {
    const project = deps.currentProject()
    if (!project) return
    const before = project.beads
    const color = deps.selectedColorHex()
    deps.pressCell(cursor.row, cursor.column)
    deps.endStroke()
    if (deps.currentProject()?.beads === before) return
    const t = deps.messages()
    const tool = deps.activeTool()
    deps.announce(
      tool === 'erase'
        ? t.a11y.erased
        : (tool === 'fill' ? t.a11y.filled : t.a11y.painted).replace('{color}', deps.colorWords(color)),
    )
  }

  /** Stretches the Selection from `from` to `to`, beginning it at `from` on the first call. */
  function extendSelectionTo(from: GridPosition, to: GridPosition) {
    if (!extending) {
      extending = true
      deps.beginSelectPress(from.row, from.column)
    }
    deps.extendSelection(to.row, to.column)
  }

  /** Ends the stretch, if one is under way. */
  function finishExtending() {
    if (extending) {
      extending = false
      deps.endStroke()
    }
  }

  return { invokeToolAt, extendSelectionTo, finishExtending }
}
