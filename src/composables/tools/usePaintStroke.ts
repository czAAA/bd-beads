import { ref } from 'vue'
import { layerAt, onLayer, type Layer, type OnLayerOptions } from '../../domain/layers'
import { isFillRefusal, type FillRefusal } from '../../domain/fill'
import { fillPressed, fillPreview, inFilledRegion, type FillPress, type FillPressReach } from '../../domain/fillPress'
import { paintCells } from '../../domain/drawing'
import { canvasMirrors, counterparts, type MirrorSetting } from '../../domain/mirror'
import type { GridPosition, PreviewCell } from '../../domain/grid'
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
  /** The first finger of a pinch was never a Select press either: it is forgotten, not taken for a tap (ticket 0868). */
  cancelSelectPress: () => void
  /** The Mirror setting (ticket 0703): a stroke lands at its counterparts too; a Fill does not (ticket 1025), though on
   * the Canvas its Area's edge is the flood's border. */
  mirror: () => MirrorSetting
  /** The Canvas positions on screen at a Fill (Fill reach, ticket 0715); nothing until the view is measured. */
  onScreen: () => Rect | undefined
  /** A Custom color about to fill joins the Palette on its first use (ticket 227), at the lift (ticket 1075). */
  colorUsed: (hex: string) => void
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
  /** The Fill a press began, waiting for its lift (ticket 1075, ADR 0098): the position and layer that were pressed. */
  let pendingFill: FillPress | undefined

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

    commitFill()
  }

  /** A cancelled pointer ends its stroke as a lift does, but a Fill waiting for its lift is dropped, not made. */
  function endCancelledStroke() {
    pendingFill = undefined
    endStroke()
  }

  /** Drops the stroke in progress with what it painted, and a Fill still waiting for its lift: the first finger of a
   * pinch was never a stroke (usePinchPan), nor is a press a hold takes over (ticket 1065). */
  function cancelStroke() {
    pendingFill = undefined
    deps.cancelSelectPress()
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
        return onLayer(project, strokeLayer, (sheet, local) => paintCells(sheet, counterparts(sheet, deps.mirror(), sources.map(local)).positions, color), counterpartsThrough(() => sources))
      }),
    )
  }

  /** How a Canvas command treats the Frame's footprint while the Mirror is on the Canvas (spec 0702's Edges): a
   * counterpart lands there, hidden; the command's own sources, and everything otherwise, the Frame keeps untouched. */
  function counterpartsThrough(sources: () => readonly GridPosition[]): OnLayerOptions {
    if (!canvasMirrors(deps.mirror())) return {}
    return { underFrame: (position) => !sources().some((source) => source.row === position.row && source.column === position.column) }
  }

  /** Paint starts a stroke at the press. Fill (ticket 25, on either button) only notes the pressed position: it lands
   * when the press lifts, wherever the pointer is by then (ticket 1075, ADR 0098), so a press that is dropped leaves
   * nothing behind. */
  function beginOrCommitPress(mode: 'paint' | 'erase', color: string | null, row: number, column: number, named?: Layer) {
    const project = deps.currentProject()
    if (!project) {
      return
    }

    const layer = layerAt(project, { row, column, ...(named ? { layer: named } : {}) })
    if (deps.activeTool() === 'fill') {
      pendingFill = { color, row, column, layer }
      return
    }

    beginStroke(mode, layer)
    paintStrokeCell(row, column, color)
  }

  /** Makes the Fill a press waited on, at the lift (ticket 1075), as one Undo step. Not mirrored (ticket 1025): the
   * flood lands where it was pressed. */
  function commitFill() {
    const pending = pendingFill
    pendingFill = undefined
    if (!pending || !deps.currentProject()) {
      return
    }
    let refused: FillRefusal | undefined
    if (pending.color) deps.colorUsed(pending.color)
    deps.edit.edit('drawing', (current) => {
      const made = fillPressed(current, pending, fillReach())
      if (!isFillRefusal(made)) return made
      // Refused, it lands nowhere: the beads as they were leave no Undo step, nothing saved.
      refused = made
      return current
    })
    if (refused) {
      fillRefusals.value += 1
      const t = deps.messages().tools
      deps.showToast('fill-refused', refused === 'open' ? t.fillOpenMessage : t.fillTooBigMessage, 'info')
    }
  }

  function fillReach(): FillPressReach {
    return { mirror: deps.mirror(), onScreen: deps.onScreen() }
  }

  /** The last Fill preview made, and what it was made from: a hover anywhere in its region floods nothing again. */
  let lastPreview: { project: Project; color: string; layer: Layer; reach: FillPressReach; region: Project; cells: PreviewCell[] } | undefined

  /** The beads a Fill pressed at `hovered` in `color` would change (ticket 1153): what the hover preview shows, by the
   * press's own command and rules. */
  function fillPreviewCells(project: Project, hovered: GridPosition, color: string): PreviewCell[] {
    const layer = layerAt(project, hovered)
    const reach = fillReach()
    const last = lastPreview
    if (last && last.project === project && last.color === color && last.layer === layer && sameReach(last.reach, reach) && inFilledRegion(project, last.region, layer, hovered)) {
      return last.cells
    }
    const { cells, region } = fillPreview(project, { row: hovered.row, column: hovered.column, layer, color }, reach)
    lastPreview = { project, color, layer, reach, region, cells }
    return cells
  }

  return { strokeMode, fillRefusals, fillPreviewCells, beginStroke, endStroke, endCancelledStroke, cancelStroke, paintStrokeCell, paintStrokeCells, beginOrCommitPress }
}

/** Whether two Fill reaches bound a flood alike: the same Mirror and the same screen. */
function sameReach(a: FillPressReach, b: FillPressReach): boolean {
  const [x, y] = [a.onScreen, b.onScreen]
  const sameScreen = x === y || (!!x && !!y && x.row === y.row && x.column === y.column && x.rows === y.rows && x.columns === y.columns)
  return a.mirror === b.mirror && sameScreen
}
