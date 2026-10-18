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

// The Paint-tool drag (tickets 24, 55; ADR 0020, 0036): begin a stroke, paint cells as the pointer moves, end it as one
// undo step and one save. Edit holds the baseline and guards; cells touched in between update the live Project
// directly, save deferred. Deps are read lazily.
export function usePaintStroke(deps: PaintStrokeDeps) {
  /** 'paint'/'erase' while a stroke is in progress, else null. */
  const strokeMode = ref<'paint' | 'erase' | null>(null)

  function beginStroke(mode: 'paint' | 'erase') {
    strokeMode.value = mode
    deps.edit.beginStroke()
  }

  // Ends a stroke or Select press, bound to mouseup/pointerup on the whole app shell (ticket 24) since a drag can end
  // anywhere, and to pointercancel (ticket 60) so an OS-interrupted touch/pen stroke doesn't leave strokeMode stuck.
  function endStroke() {
    deps.endSelectPress()

    strokeMode.value = null

    // The stroke's one Undo step and one write: every cell it painted deferred its save (see paintStrokeCell). A no-op
    // when the mouseup wasn't ending a stroke at all.
    deps.edit.endStroke()
  }

  /** Drops the stroke in progress with what it painted: the first finger of a pinch was never a stroke
   * (usePinchPan). */
  function cancelStroke() {
    deps.endSelectPress()
    strokeMode.value = null
    deps.edit.cancelStroke()
  }

  // Paints (or, with a null color, erases) one cell of a stroke, live-mirrored per the Mirror axis counts, skipping
  // woven rows (ticket 33). The one caller that defers its save (ticket 55): a stroke touches hundreds of cells a
  // second. The cell lands in the library at once; endStroke makes the stroke one write.
  function paintStrokeCell(row: number, column: number, color: string | null) {
    deps.edit.strokeStep((project) => paintCells(project, [{ row, column }], color, deps.mirrorAxisCounts(), deps.mirrorCopyMode()))
  }

  /** Fill acts immediately, in one click, on either button (ticket 25); Paint starts a stroke, live-mirrored per
   * cell. */
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
