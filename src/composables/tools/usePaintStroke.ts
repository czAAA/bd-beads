import { ref, toRaw } from 'vue'
import type { MirrorAxisCounts } from '../../domain/mirror'
import {
  fillArea,
  keepFinishedRows,
  paintCells,
  type Grid,
  type Pattern,
  type UndoEntry,
} from '../../domain/pattern'
import type { Tool } from '../../domain/tool'
import type { ReplaceOptions } from '../pattern/usePatternLibrary'

/** What a stroke needs from the app shell: the open Pattern and its write path, Mirror, the active Tool, and undo. */
export interface PaintStrokeDeps {
  currentPattern: () => Pattern | undefined
  replacePattern: (pattern: Pattern, options?: ReplaceOptions) => void
  mirrorAxisCounts: () => MirrorAxisCounts
  mirrorCopyMode: () => boolean
  activeTool: () => Tool
  /** Fill's one-click commit: a single undo step (useUndoHistory). */
  commitGridChange: (pattern: Pattern, updated: Pattern) => void
  /** Pushes a stroke's one undo step (useUndoHistory). */
  recordHistory: (entry: UndoEntry) => void
  /** A Select press ends on the same mouseup as a stroke does. */
  endSelectPress: () => void
  /** Writes the save every painted cell deferred. */
  flushPendingSave: () => void
}

/**
 * The Paint-tool drag (tickets 24, 55; ADR 0023): begin a stroke, paint cells as the pointer moves, end it as one undo
 * step and one save. The grid a stroke started from is captured once, in strokeBaseline; every cell touched in between
 * just updates the live Pattern directly, with its save deferred. Deps are read lazily.
 */
export function usePaintStroke(deps: PaintStrokeDeps) {
  /** 'paint'/'erase' while a stroke is in progress, else null. */
  const strokeMode = ref<'paint' | 'erase' | null>(null)
  const strokeBaseline = ref<Grid | null>(null)

  function beginStroke(mode: 'paint' | 'erase', pattern: Pattern) {
    strokeMode.value = mode
    strokeBaseline.value = pattern.grid
  }

  /**
   * Ends an in-progress stroke or Select press, bound to mouseup/pointerup on the whole app shell (ticket 24): a
   * drag can end with the button/finger/pen released anywhere, not just back over the cell it started on. Also bound
   * to pointercancel (ticket 60) so a touch/pen stroke the OS interrupts mid-drag doesn't leave strokeMode stuck.
   */
  function endStroke() {
    deps.endSelectPress()

    const pattern = deps.currentPattern()
    if (strokeBaseline.value && pattern && pattern.grid !== strokeBaseline.value) {
      deps.recordHistory({ grid: strokeBaseline.value })
    }
    strokeMode.value = null
    strokeBaseline.value = null

    // The stroke's one write: every cell it painted deferred its save (see paintStrokeCell), so the whole stroke
    // reaches storage here, once. A no-op when the mouseup wasn't ending a stroke at all.
    deps.flushPendingSave()
  }

  /**
   * Paints (or, with a null color, erases) one cell of an in-progress stroke, live-mirrored per the Mirror axis counts,
   * leaving rows already woven alone (ticket 33).
   *
   * This is the one caller that defers its save (ticket 55): a stroke can touch hundreds of cells in a second, and
   * saving each one wrote the whole Pattern library per mousemove. The cell lands in the library immediately — it's on
   * screen and undoable either way — and endStroke turns the whole stroke into a single write.
   */
  function paintStrokeCell(row: number, column: number, color: string | null) {
    // Worked on as the Pattern itself, not through the library's reactive wrapper: a stroke step reads a bead or two,
    // but comparing what it left for finished rows reads them all, and each read through a proxy is many times the cost.
    const current = deps.currentPattern()
    const pattern = current && toRaw(current)
    if (!pattern) {
      return
    }

    const painted = paintCells(pattern, [{ row, column }], color, deps.mirrorAxisCounts(), deps.mirrorCopyMode())

    const updated = keepFinishedRows(pattern, painted)
    if (updated !== pattern) {
      deps.replacePattern(updated, { deferSave: true })
    }
  }

  /** Fill acts immediately, in one click, on either button (ticket 25); Paint starts a stroke, live-mirrored per cell. */
  function beginOrCommitPress(mode: 'paint' | 'erase', color: string | null, row: number, column: number) {
    const pattern = deps.currentPattern()
    if (!pattern) {
      return
    }

    if (deps.activeTool() === 'fill') {
      deps.commitGridChange(pattern, fillArea(pattern, row, column, color))
      return
    }

    beginStroke(mode, pattern)
    paintStrokeCell(row, column, color)
  }

  return { strokeMode, beginStroke, endStroke, paintStrokeCell, beginOrCommitPress }
}
