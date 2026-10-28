import { ref } from 'vue'
import { frameContains } from '../../domain/canvas'
import { layerAt, onLayer, type Layer } from '../../domain/layers'
import { fillArea } from '../../domain/fill'
import { paintCells } from '../../domain/drawing'
import type { Project } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import type { Edit } from '../project/useEdit'

/** What a stroke needs from the app shell: the open Project, Edit and its stroke calls and the active Tool. */
export interface PaintStrokeDeps {
  currentProject: () => Project | undefined
  edit: Pick<Edit, 'edit' | 'beginStroke' | 'strokeStep' | 'endStroke' | 'cancelStroke'>
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
  /** The layer the stroke began on, which it stays on however far the pointer goes (ADR 0066). */
  let strokeLayer: Layer = 'canvas'

  function beginStroke(mode: 'paint' | 'erase', layer: Layer) {
    strokeMode.value = mode
    strokeLayer = layer
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

  // Paints (or, with a null color, erases) one cell of a stroke, skipping
  // woven rows (ticket 33). The one caller that defers its save (ticket 55): a stroke touches hundreds of cells a
  // second. The cell lands in the library at once; endStroke makes the stroke one write.
  function paintStrokeCell(row: number, column: number, color: string | null, layer?: Layer) {
    // The pointer is over the other layer, where this one's positions are not (ADR 0066): nothing lands.
    if (layer && layer !== strokeLayer) {
      return
    }
    deps.edit.strokeStep((project) =>
      onLayer(project, strokeLayer, (view, local) => {
        const at = local({ row, column })
        // The Frame holds only its own cells: a stroke that began in it leaves nothing where the pointer goes outside.
        return view.frame && !frameContains(view.frame, at) ? view : paintCells(view, [at], color)
      }),
    )
  }

  /** Fill acts immediately, in one click, on either button (ticket 25); Paint starts a stroke. */
  function beginOrCommitPress(mode: 'paint' | 'erase', color: string | null, row: number, column: number, named?: Layer) {
    const project = deps.currentProject()
    if (!project) {
      return
    }

    const layer = layerAt(project, { row, column, ...(named ? { layer: named } : {}) })
    if (deps.activeTool() === 'fill') {
      deps.edit.edit('drawing', (current) => onLayer(current, layer, (view, local) => {
        const at = local({ row, column })
        return fillArea(view, at.row, at.column, color)
      }))
      return
    }

    beginStroke(mode, layer)
    paintStrokeCell(row, column, color)
  }

  return { strokeMode, beginStroke, endStroke, cancelStroke, paintStrokeCell, beginOrCommitPress }
}
