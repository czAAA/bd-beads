import { computed, ref } from 'vue'
import type { Rect } from '../../domain/canvas'
import type { FrameEdge } from '../../domain/frame'
import type { GridPosition } from '../../domain/grid'
import { isMirrorOn, MIRROR_OFF, mirrorSettingOf, placeRect, shapeAxesOf, withMirror, withMirrorPlace, type MirrorPlace, type MirrorSetting } from '../../domain/mirror'
import type { Project } from '../../domain/project'
import { movedSelection, selectionFrame, selectionWithEdges, type Selection } from '../../domain/selection'
import type { FramePress } from '../../rendering/frameHandles'
import type { EditFn } from '../project/useEdit'

/** What Mirror needs from the app shell: the open Project and its two write paths. A bar setting is not an Undo step,
 * so it goes to `replaceProject` as Letters does (ADR 0036's "outside Edit"); making, moving, resizing and closing the
 * Mirror are, through `edit`. */
export interface MirrorFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  edit: EditFn
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

  /** The Mirror bar changed the Mode, an Axis or a count: saved with the Project, no Undo step. */
  function update(next: MirrorSetting) {
    const project = deps.currentProject()
    if (project) deps.replaceProject(withMirror(project, next))
  }

  /** The Mirror made, moved or resized to a place, replacing the one before, one Undo step (ADR 0082). */
  function place(to: MirrorPlace) {
    deps.edit('exempt', (current) => withMirrorPlace(current, to))
  }

  /** A Canvas rectangle as the Mirror's Area: a Mirror-mode drag's, or a Selection's (the Selection bar's Mirror). */
  function makeFrom(area: Rect) {
    place({ layer: 'canvas', area })
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

  /** The held handle or inside dragged to a cell: the Area follows, as the Selection does. */
  function dragArea(cell: GridPosition) {
    if (!adjust) return
    const moved = adjust.kind === 'resize' ? selectionWithEdges(adjust.start, adjust.edges, cell) : movedSelection(adjust.start, cell.row - adjust.origin.row, cell.column - adjust.origin.column)
    draft.value = selectionFrame(moved)
  }

  /** Let go: the Area is saved where the drag left it, one Undo step; nothing when it did not change. */
  function releaseArea() {
    const area = draft.value
    adjust = undefined
    draft.value = undefined
    const before = saved.value.place
    if (!area || (before?.layer === 'canvas' && ['row', 'column', 'rows', 'columns'].every((key) => before.area[key as keyof Rect] === area[key as keyof Rect]))) return
    makeFrom(area)
  }

  return { setting, on, onFrame, rect, shape, marking, areaSelection, adjusting: computed(() => draft.value !== undefined), update, makeFrom, placeWholeFrame, close, pressArea, dragArea, releaseArea }
}
