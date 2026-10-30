import { ref } from 'vue'
import { layerAt, onLayer, type Layer, type OnLayerOptions } from '../../domain/layers'
import { fillArea, isFillRefusal, type FillRefusal } from '../../domain/fill'
import { paintCells } from '../../domain/drawing'
import { canvasMirrors, counterparts, isMirrorOn, type MirrorSetting } from '../../domain/mirror'
import { changedPositions } from '../../domain/canvas'
import type { GridPosition } from '../../domain/grid'
import type { Project } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import type { Edit } from '../project/useEdit'
import type { Rect } from '../../domain/canvas'
import type { Translations } from '../../i18n/translations'
import type { MessageTone } from '../ui/useToasts'

/** What a stroke needs from the app shell: the open Project, Edit and its stroke calls and the active Tool. */
export interface PaintStrokeDeps {
  currentProject: () => Project | undefined
  edit: Pick<Edit, 'edit' | 'beginStroke' | 'strokeStep' | 'endStroke' | 'cancelStroke'>
  activeTool: () => Tool
  /** A Select press ends on the same mouseup as a stroke does. */
  endSelectPress: () => void
  /** The Mirror setting (ticket 0703): a stroke and a Fill land at their counterparts too. */
  mirror: () => MirrorSetting
  /** The Canvas positions on screen at a Fill press (Fill reach, ticket 0715); nothing until the view is measured. */
  onScreen: () => Rect | undefined
  showToast: (id: string, text: string, tone?: MessageTone) => void
  messages: () => Translations
}

// The Paint-tool drag (tickets 24, 55; ADR 0020, 0036): begin a stroke, paint cells as the pointer moves, end it as one
// undo step and one save. Edit holds the baseline and guards; cells touched in between update the live Project
// directly, save deferred. Deps are read lazily.
export function usePaintStroke(deps: PaintStrokeDeps) {
  /** 'paint'/'erase' while a stroke is in progress, else null. */
  const strokeMode = ref<'paint' | 'erase' | null>(null)
  /** The layer the stroke began on, which it stays on however far the pointer goes (ADR 0066). */
  let strokeLayer: Layer = 'canvas'
  /** How many Fill presses Fill reach has refused (ticket 0715): the canvas shows the not-allowed cue each time it grows. */
  const fillRefusals = ref(0)

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
    paintStrokeCells([layer ? { row, column, layer } : { row, column }], color)
  }

  /** Paints the beads a stroke crossed in one pointer move as one stroke step (ticket 0674): each bead is kept or
   * refused by the rules as if it came alone, and the lot lands in the library, and on screen, once. */
  function paintStrokeCells(cells: GridPosition[], color: string | null) {
    // The pointer is over the other layer, where this one's positions are not (ADR 0066): nothing lands.
    const landing = cells.filter((cell) => !cell.layer || cell.layer === strokeLayer)
    if (landing.length === 0) {
      return
    }
    deps.edit.strokeStep(
      ...landing.map((cell) => (project: Project) => {
        const sources = [{ row: cell.row, column: cell.column }]
        // The Frame holds only its own positions: a stroke that began in it leaves nothing where the pointer goes outside.
        return onLayer(project, strokeLayer, (sheet, local) => paintCells(sheet, counterparts(sheet, deps.mirror(), sources.map(local)).positions, color), counterpartsThrough(project, () => sources))
      }),
    )
  }

  /** How a Canvas command treats the Frame's footprint while the Canvas mirrors (ticket 0704, spec 0702's Edges): a
   * counterpart lands there, hidden; the command's own sources, and everything otherwise, the Frame keeps untouched. */
  function counterpartsThrough(project: Project, sources: () => readonly GridPosition[]): OnLayerOptions {
    if (!canvasMirrors(project, deps.mirror())) return {}
    return { underFrame: (position) => !sources().some((source) => source.row === position.row && source.column === position.column) }
  }

  /** Fill acts immediately, in one click, on either button (ticket 25); Paint starts a stroke. */
  function beginOrCommitPress(mode: 'paint' | 'erase', color: string | null, row: number, column: number, named?: Layer) {
    const project = deps.currentProject()
    if (!project) {
      return
    }

    const layer = layerAt(project, { row, column, ...(named ? { layer: named } : {}) })
    if (deps.activeTool() === 'fill') {
      let refused: FillRefusal | undefined
      deps.edit.edit('drawing', (current) => {
        /** What the flood itself changed: the sources, which stay clear of the Frame. */
        let flooded: GridPosition[] = []
        return onLayer(current, layer, (sheet, local) => {
          const at = local({ row, column })
          const filled = fillArea(sheet, at.row, at.column, color, { onScreen: deps.onScreen() })
          if (isFillRefusal(filled)) {
            // Refused, it lands nowhere, counterparts included: the beads as they were leave no Undo step, nothing saved.
            refused = filled
            return sheet.beads
          }
          // Under Mirror the flooded region's counterparts take the color too (ticket 0703): what the flood changed, mapped.
          if (filled === sheet.beads || !isMirrorOn(deps.mirror())) return filled
          flooded = changedPositions(sheet.beads, filled)
          return paintCells({ ...sheet, beads: filled }, counterparts(sheet, deps.mirror(), flooded).positions, color)
        }, counterpartsThrough(current, () => flooded))
      })
      if (refused) {
        fillRefusals.value += 1
        const t = deps.messages().tools
        deps.showToast('fill-refused', refused === 'open' ? t.fillOpenMessage : t.fillTooBigMessage, 'info')
      }
      return
    }

    beginStroke(mode, layer)
    paintStrokeCell(row, column, color)
  }

  return { strokeMode, fillRefusals, beginStroke, endStroke, cancelStroke, paintStrokeCell, paintStrokeCells, beginOrCommitPress }
}
