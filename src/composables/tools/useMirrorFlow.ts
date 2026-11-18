import { computed, ref } from 'vue'
import type { Rect } from '../../domain/canvas'
import type { FrameEdge } from '../../domain/frame'
import type { GridPosition } from '../../domain/grid'
import { fittedCanvasArea, isMirrorOn, MIRROR_OFF, mirrorFitOf, mirrorGrowthOf, mirrorSettingOf, placeRect, shapeAxesOf, withMirror, withMirrorPlace, type FitAnchor, type MirrorPlace, type MirrorSetting } from '../../domain/mirror'
import type { Project } from '../../domain/project'
import type { Locale, Translations } from '../../i18n/translations'
import { movedSelection, selectionFrame, selectionWithEdges, type Selection } from '../../domain/selection'
import type { FramePress } from '../../rendering/frameHandles'
import type { EditFn } from '../project/useEdit'
import type { MessageTone } from '../ui/useToasts'
import { mirrorGrownMessage } from './mirrorGrownMessage'

/** What Mirror needs from the app shell: the open Project and its two write paths. A bar setting is not an Undo step,
 * so it goes to `replaceProject` as Letters does (ADR 0036's "outside Edit"); making, moving, resizing and closing the
 * Mirror are, through `edit`, and so is a bar setting that grows the Canvas Area (ticket 1027), which a Message tells. */
export interface MirrorFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  edit: EditFn
  showToast: (id: string, text: string, tone?: MessageTone) => void
  messages: () => Translations
  /** The language the grown Area's Message counts in. */
  locale: () => Locale
}

/** The Mirror's state (ADR 0082, ticket 0750): the one Mirror of the Project and its place, Mirror mode (the tile's pick,
 * where the Select tool's drag makes the Area), the bar's settings, and the Area's handles while in Mirror mode, dragged
 * as the Selection's are and saved as one Undo step on release. */
export function useMirrorFlow(deps: MirrorFlowDeps) {
  const saved = computed<MirrorSetting>(() => {
    const project = deps.currentProject()
    return project ? mirrorSettingOf(project) : MIRROR_OFF
  })
  /** Whether Mirror mode is on (ToolPill card): the Select tool's drag makes the Area, the Area's handles take a press.
   * The shell enters and leaves it with the tool (useAppShell). */
  const marking = ref(false)
  /** The Canvas Area as its handles drag it, before the release saves it. */
  const draft = ref<Rect>()
  let adjust: { kind: 'resize'; edges: FrameEdge[]; start: Selection } | { kind: 'move'; origin: GridPosition; start: Selection } | undefined
  /** What the hand asks of the Area while its handles or inside are dragged, before it sticks to a Fitting size. */
  let asked: { area: Rect; from: FitAnchor } | undefined

  /** The Mirror as drawn and as the bar shows it: the saved one, its Area where a drag has it meanwhile. */
  const setting = computed<MirrorSetting>(() => (draft.value ? { ...saved.value, place: { layer: 'canvas', area: draft.value } } : saved.value))
  const on = computed(() => isMirrorOn(setting.value))
  /** Whether the whole Frame is the Mirror's Area: the margin's Mirror the whole Frame is pressed (MarginSheet card). */
  const onFrame = computed(() => setting.value.place?.layer === 'frame')
  /** The Area in its layer's own positions (the Frame's rectangle for the whole Frame), for the bar's size and counts. */
  const rect = computed(() => {
    const project = deps.currentProject()
    const place = setting.value.place
    return project && place ? placeRect(project, place) : undefined
  })
  /** What the Area offers the bar's chips and Steppers (ticket 0775): the counts and Folds peyote's and brick's half-bead
   * shift has an exact image for, every one on loom. */
  const fit = computed(() => {
    const project = deps.currentProject()
    return project ? mirrorFitOf(project, setting.value) : undefined
  })
  /** A Custom frame's own Axes while the whole Frame is the Mirror (ADR 0082): fixed, the bar notes them. */
  const shape = computed(() => {
    const project = deps.currentProject()
    return project && onFrame.value ? shapeAxesOf(project) : undefined
  })
  /** The Canvas Area as a Selection, for the Select tool's handles in Mirror mode; none for the whole Frame. */
  const areaSelection = computed<Selection | undefined>(() => {
    const place = setting.value.place
    return place?.layer === 'canvas' ? { top: place.area.row, left: place.area.column, rows: place.area.rows, columns: place.area.columns, layer: 'canvas' } : undefined
  })

  /** The Mirror bar changed the Mode, an Axis, a count or the Fold: saved with the Project, no Undo step. Where a Canvas
   * Area does not fit it, the Area grows right and down to the nearest Fitting size (ticket 1027): one Undo step for the
   * setting and the size together, and a Message saying what it grew for. */
  function update(next: MirrorSetting) {
    const project = deps.currentProject()
    if (!project) return
    const growth = mirrorGrowthOf(project, next)
    if (!growth) {
      deps.replaceProject(withMirror(project, next))
      return
    }
    const outcome = deps.edit('exempt', (current) => withMirrorPlace(withMirror(current, next), { layer: 'canvas', area: growth.area }))
    if (outcome.kind === 'applied') deps.showToast('mirror-grown', mirrorGrownMessage(deps.messages(), deps.locale(), next, growth), 'info')
  }

  /** The Mirror made, moved or resized to a place, replacing the one before, one Undo step (ADR 0082). */
  function place(to: MirrorPlace) {
    deps.edit('exempt', (current) => withMirrorPlace(current, to))
  }

  /** A Canvas rectangle as the Mirror's Area: a Mirror-mode drag's, a Selection's (the Selection bar's Mirror), or the
   * one a handle's drag or a move asks. It takes the nearest Fitting size (ticket 1028), grown right and down but on the
   * edges `from` keeps, one Undo step; an Area that ended bigger than asked says so in a Message. */
  function makeFrom(area: Rect, from: FitAnchor = {}) {
    const project = deps.currentProject()
    if (!project) return
    const growth = fittedCanvasArea(project, area, from)
    const outcome = deps.edit('exempt', (current) => withMirrorPlace(current, { layer: 'canvas', area: growth.area }))
    if (outcome.kind === 'applied' && Object.keys(growth.grewFor).length > 0) deps.showToast('mirror-grown', mirrorGrownMessage(deps.messages(), deps.locale(), saved.value, growth), 'info')
  }

  /** Mirror the whole Frame (MarginSheet card). */
  function placeWholeFrame() {
    place({ layer: 'frame' })
  }

  /** Close mirror: the Mirror off and its Area dropped, its Mode, Axes and counts kept for the next one; one Undo step. */
  function close() {
    if (saved.value.place) deps.edit('exempt', (current) => withMirrorPlace(current, undefined))
  }

  /** A press on the Area's handles or inside it in Mirror mode: a handle resizes it, the inside moves it. */
  function pressArea(target: FramePress, cell: GridPosition) {
    const start = areaSelection.value
    if (!start) return
    if (target.kind === 'handle') adjust = { kind: 'resize', edges: target.edges, start }
    else if (target.kind === 'inside') adjust = { kind: 'move', origin: cell, start }
  }

  /** The held handle or inside dragged to a cell: the Area follows, as the Selection does, at the nearest Fitting size
   * (ticket 1028), the edge opposite a dragged handle kept. */
  function dragArea(cell: GridPosition) {
    const project = deps.currentProject()
    if (!adjust || !project) return
    const moved = adjust.kind === 'resize' ? selectionWithEdges(adjust.start, adjust.edges, cell) : movedSelection(adjust.start, cell.row - adjust.origin.row, cell.column - adjust.origin.column)
    asked = { area: selectionFrame(moved), from: adjust.kind === 'resize' ? keptEdges(adjust.edges) : {} }
    draft.value = fittedCanvasArea(project, asked.area, asked.from).area
  }

  /** An arrow on the Mirror bar's move grip (ticket 0808): the Canvas Area moves by that many beads, one Undo step, as a
   * drag of it does. */
  function moveAreaBy(rows: number, columns: number) {
    const start = areaSelection.value
    if (start) makeFrom(selectionFrame(movedSelection(start, rows, columns)))
  }

  /** Let go: the Area is saved where the drag left it, one Undo step, with the Message if it stuck bigger than the hand
   * asked; nothing when it did not change. */
  function releaseArea() {
    const area = draft.value
    const ask = asked
    adjust = undefined
    asked = undefined
    draft.value = undefined
    const before = saved.value.place
    if (!area || !ask || (before?.layer === 'canvas' && ['row', 'column', 'rows', 'columns'].every((key) => before.area[key as keyof Rect] === area[key as keyof Rect]))) return
    makeFrom(ask.area, ask.from)
  }

  /** Forgets a press on the Area whose hold opened the Radial toolbox (ticket 1084): the Area is as it was, nothing recorded. */
  function dropArea() {
    adjust = undefined
    asked = undefined
    draft.value = undefined
  }

  return {
    setting,
    on,
    onFrame,
    rect,
    fit,
    shape,
    marking,
    areaSelection,
    adjusting: computed(() => draft.value !== undefined),
    /** Whether a press holds the Area's handle, inside or move grip: its drags are the Area's. */
    holding: () => adjust !== undefined,
    update,
    makeFrom,
    placeWholeFrame,
    close,
    pressArea,
    dragArea,
    releaseArea,
    dropArea,
    moveAreaBy,
  }
}

/** The edges a handle's drag keeps where they are as the Area grows to fit (ticket 1028): the one opposite each dragged
 * edge, in the directions the handle resizes. */
function keptEdges(edges: readonly FrameEdge[]): FitAnchor {
  const kept = (first: FrameEdge, last: FrameEdge) => (edges.includes(first) ? 'last' : edges.includes(last) ? 'first' : undefined)
  const leftRight = kept('left', 'right')
  const topBottom = kept('top', 'bottom')
  return { ...(leftRight ? { leftRight } : {}), ...(topBottom ? { topBottom } : {}) }
}
