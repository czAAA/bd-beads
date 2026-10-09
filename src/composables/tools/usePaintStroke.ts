import { ref } from 'vue'
import type { MirrorAxisCounts } from '../../domain/mirror'
import { fillArea, paintCells, type Project } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import type { Edit } from '../project/useEdit'

/** What a stroke needs from the app shell: the open Project, Edit and its stroke calls, Mirror and the active Tool. */
export interface PaintStrokeDeps {
  currentProject: () => Project | undefined
  edit: Pick<Edit, 'edit' | 'beginStroke' | 'strokeStep' | 'endStroke' | 'cancelStroke'>
  mirrorAxisCounts: () => MirrorAxisCounts
  mirrorCopyMode: () => boolean
  activeTool: () => Tool
  /** A Select press ends on the same mouseup as a stroke does. */
  endSelectPress: () => void
}

/**
 * The Paint-tool drag (tickets 24, 55; ADR 0023, 0036): begin a stroke, paint cells as the pointer moves, end it as one
 * undo step and one save. Edit holds the baseline and the guards; every cell touched in between updates the live
 * Project directly, with its save deferred. Deps are read lazily.
 */
export function usePaintStroke(deps: PaintStrokeDeps) {
  /** 'paint'/'erase' while a stroke is in progress, else null. */
  const strokeMode = ref<'paint' | 'erase' | null>(null)

  function beginStroke(mode: 'paint' | 'erase') {
    strokeMode.value = mode
    deps.edit.beginStroke()
  }

  /**
   * Ends an in-progress stroke or Select press, bound to mouseup/pointerup on the whole app shell (ticket 24): a
   * drag can end with the button/finger/pen released anywhere, not just back over the cell it started on. Also bound
   * to pointercancel (ticket 60) so a touch/pen stroke the OS interrupts mid-drag doesn't leave strokeMode stuck.
   */
  function endStroke() {
    deps.endSelectPress()

    strokeMode.value = null

    // The stroke's one Undo step and one write: every cell it painted deferred its save (see paintStrokeCell). A no-op
    // when the mouseup wasn't ending a stroke at all.
    deps.edit.endStroke()
  }

  /** Drops the stroke in progress with what it painted: the first finger of a pinch was never a stroke (usePinchPan). */
  function cancelStroke() {
    deps.endSelectPress()
    strokeMode.value = null
    deps.edit.cancelStroke()
  }

  /**
   * Paints (or, with a null color, erases) one cell of an in-progress stroke, live-mirrored per the Mirror axis counts,
   * leaving rows already woven alone (ticket 33).
   *
   * This is the one caller that defers its save (ticket 55): a stroke can touch hundreds of cells in a second, and
   * saving each one wrote the whole Project library per mousemove. The cell lands in the library immediately — it's on
   * screen and undoable either way — and endStroke turns the whole stroke into a single write.
   */
  function paintStrokeCell(row: number, column: number, color: string | null) {
    deps.edit.strokeStep((project) => paintCells(project, [{ row, column }], color, deps.mirrorAxisCounts(), deps.mirrorCopyMode()))
  }

  /** Fill acts immediately, in one click, on either button (ticket 25); Paint starts a stroke, live-mirrored per cell. */
  function beginOrCommitPress(mode: 'paint' | 'erase', color: string | null, row: number, column: number) {
    const project = deps.currentProject()
    if (!project) {
      return
    }

    if (deps.activeTool() === 'fill') {
      deps.edit.edit('drawing', (current) => fillArea(current, row, column, color))
      return
    }

    beginStroke(mode)
    paintStrokeCell(row, column, color)
  }

  return { strokeMode, beginStroke, endStroke, cancelStroke, paintStrokeCell, beginOrCommitPress }
}
