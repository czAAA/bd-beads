import { computed, ref } from 'vue'
import type { Rect } from '../../domain/canvas'
import { fillBlanks } from '../../domain/fillBlanks'
import type { GridPosition } from '../../domain/grid'
import {
  areaBetween,
  axisLimitsOf,
  canvasAxesOf,
  isMirrorOn,
  MIRROR_DIRECTIONS,
  MIRROR_OFF,
  mirrorAreaOf,
  mirrorLayerOf,
  mirrorSettingOf,
  snapAxis,
  snapCentre,
  toggledMirror,
  withAxesPlaced,
  withCanvasAxes,
  withMirror,
  withMirrorArea,
  type CanvasAxes,
  type MirrorAxis,
  type MirrorDirection,
  type MirrorMode,
  type MirrorSetting,
  type RadialCentre,
} from '../../domain/mirror'
import { frameOf, layerOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { Translations } from '../../i18n/translations'
import { axisAtGridPx } from '../../rendering/mirrorAxes'
import type { EditFn } from '../project/useEdit'
import type { MessageTone } from '../ui/useToasts'

/** What Mirror needs from the app shell: the open Project and its write paths, and where the view's middle is. A
 * setting is not an Undo step, so it goes to `replaceProject` as Letters does (ADR 0036's "outside Edit"); a dragged
 * Axis handle is one, through `edit` (ticket 0704). */
export interface MirrorFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  edit: EditFn
  /** The point of the Canvas, in its grid px, under the middle of the view; nothing until the view is measured. */
  viewCentre: () => { x: number; y: number } | undefined
  /** A set Area is said in a toast (ticket 0710, MirrorPopover card). */
  showToast: (id: string, text: string, tone?: MessageTone) => void
  messages: () => Translations
}

/** The Mirror mode's state (ADR 0082, spec 0702, ticket 0703): the setting, the tile's light, the popover, the count
 * limits, key `8`'s toggle (remembering its last mode), the open Canvas's handles (tickets 0704, 0705), placed at the
 * view's centre and dragged as one Undo step, and the Area (0710), picked over the beads or the whole Frame. */
export function useMirrorFlow(deps: MirrorFlowDeps) {
  const setting = computed<MirrorSetting>(() => {
    const project = deps.currentProject()
    return project ? mirrorSettingOf(project) : MIRROR_OFF
  })
  const on = computed(() => isMirrorOn(setting.value))
  const limits = computed(() => {
    const project = deps.currentProject()
    return project && axisLimitsOf(project)
  })
  /** Whether the open Canvas is the only layer: the popover's details are then the Canvas's (ticket 0704). */
  const onCanvas = computed(() => {
    const project = deps.currentProject()
    return !!project && !frameOf(project)
  })
  const popoverOpen = ref(false)
  /** The mode key `8` turns back on: Mirror until Repeat has been chosen. */
  let lastMode: Exclude<MirrorMode, 'off'> = 'mirror'

  /** The layer the popover's Area row is for (ticket 0710): the Frame on a grid, or the open Canvas; none on a Custom
   * frame, whose Axes are the shape's (ticket 0706). */
  const areaRow = computed<'frame' | 'canvas' | undefined>(() => {
    const project = deps.currentProject()
    if (!project) return undefined
    const frame = frameOf(project)
    return frame ? (frame.shape ? undefined : 'frame') : 'canvas'
  })
  /** That layer's Area, where one is set. */
  const area = computed(() => {
    const project = deps.currentProject()
    return project && mirrorAreaOf(project, mirrorLayerOf(project))
  })
  /** Whether Select area is picking on the canvas: the popover is closed meanwhile and the pointer draws the band. */
  const picking = ref(false)
  /** The rubber band a pick drags, from its press to the pointer, in the layer's positions; none until the press. */
  const band = ref<Rect>()
  let pickPress: GridPosition | undefined

  /** The handle being dragged and where its Axis or the centre is as it goes, snapped, before the release saves it. */
  const held = ref<{ axis: MirrorDirection; at: number } | { axis: 'radial'; at: RadialCentre }>()
  const heldAxis = computed(() => held.value?.axis)

  /** The Canvas Axes that act: a straight one on in the setting, placed, in Mirror mode (Repeat has no strip to repeat
   * on an open Canvas, spec 0702); Radial's centre when Radial is on and placed, in either mode (a turn needs no edge,
   * ticket 0705); the one being dragged where the drag has it. The overlay draws these. */
  const canvasAxes = computed<CanvasAxes>(() => {
    const project = deps.currentProject()
    // With an Area on the Canvas the Axes run inside it and the handles give way (ticket 0710).
    if (!project || !on.value || mirrorAreaOf(project, 'canvas')) return {}
    const placed = canvasAxesOf(project)
    const drag = held.value
    if (setting.value.axes.radial) {
      const centre = drag?.axis === 'radial' ? drag.at : placed.centre
      return centre ? { centre } : {}
    }
    if (setting.value.mode !== 'mirror') return {}
    const acting: CanvasAxes = {}
    for (const direction of MIRROR_DIRECTIONS) {
      const at = drag?.axis === direction ? drag.at : placed[direction]
      if (setting.value.axes[direction] && at !== undefined) acting[direction] = at
    }
    return acting
  })

  /** The view's middle as Axis positions, unsnapped, in the Canvas's Weave. */
  function centreAxes(project: Project): Record<MirrorDirection, number> | undefined {
    const centre = deps.viewCentre()
    if (!centre) return undefined
    const { weave } = layerOf(project, 'canvas')
    return { leftRight: axisAtGridPx(weave, 'leftRight', centre.x), topBottom: axisAtGridPx(weave, 'topBottom', centre.y) }
  }

  function update(next: MirrorSetting) {
    const project = deps.currentProject()
    if (!project) return
    if (next.mode !== 'off') lastMode = next.mode
    const axes = canvasAxesOf(project)
    const placed = withAxesPlaced(axes, setting.value, next, centreAxes(project))
    const changed = withMirror(project, next)
    deps.replaceProject(placed === axes ? changed : withCanvasAxes(changed, placed))
  }

  function toggle() {
    update(toggledMirror(setting.value, lastMode))
  }

  /** The tile pressed: the popover opens or closes; while an Area is being picked it cancels the pick instead. */
  function togglePopover() {
    if (cancelPick()) return
    popoverOpen.value = !popoverOpen.value
  }

  /** Select area pressed: the popover closes so the drawing shows, and the next drag over the beads sets the Area. */
  function startPick() {
    popoverOpen.value = false
    band.value = undefined
    pickPress = undefined
    picking.value = true
  }

  /** Escape or the tile while picking: nothing is set and the popover comes back. Whether there was a pick to cancel. */
  function cancelPick(): boolean {
    if (!picking.value) return false
    endPick()
    return true
  }

  function endPick() {
    picking.value = false
    band.value = undefined
    pickPress = undefined
    popoverOpen.value = true
  }

  /** The Frame's rectangle in its own positions, the pick's bounds, or none on the open Canvas. */
  function frameEdge(project: Project): Rect | undefined {
    const frame = frameOf(project)
    return frame && { row: 0, column: 0, rows: frame.rows, columns: frame.columns }
  }

  /** The pick's press, on a cell of the layer the Area is for: the band starts there. */
  function pressArea(cell: GridPosition) {
    const project = deps.currentProject()
    if (!picking.value || !project) return
    pickPress = cell
    band.value = areaBetween(cell, cell, frameEdge(project))
  }

  /** The pick's drag over another cell: the band spans the press and the pointer, kept inside the Frame. */
  function dragArea(cell: GridPosition) {
    const project = deps.currentProject()
    if (!pickPress || !project) return
    band.value = areaBetween(pickPress, cell, frameEdge(project))
  }

  /** The pick released: the band is the Area (MirrorPopover card: the popover back and a toast). Nothing with no press. */
  function releaseArea() {
    const rect = band.value
    if (!picking.value) return
    endPick()
    if (!rect) return
    setArea(rect, fillBlanks(deps.messages().mirror.areaSetMessage, { columns: rect.columns, rows: rect.rows }))
  }

  /** The whole Frame as the Area: the margin's press while picking, or the Whole Frame button. */
  function pickWholeFrame() {
    const project = deps.currentProject()
    const edge = project && frameEdge(project)
    if (picking.value) endPick()
    if (!edge) return
    setArea(edge, deps.messages().mirror.wholeFrameMessage)
  }

  /** The Area set on the layer, one Undo step; if the mode was Off it becomes Mirror, with Left–right on if no Axis
   * was (as key `8` turns it on). */
  function setArea(rect: Rect, message: string) {
    const project = deps.currentProject()
    if (!project) return
    const layer = mirrorLayerOf(project)
    deps.edit('exempt', (current) => withMirrorArea(current, layer, rect))
    if (!isMirrorOn(setting.value)) update(toggledMirror(setting.value, 'mirror'))
    deps.showToast('mirror-area', message, 'info')
  }

  /** Clear the area: the Axes run through the whole layer again, one Undo step. */
  function clearArea() {
    const project = deps.currentProject()
    if (!project) return
    const layer = mirrorLayerOf(project)
    deps.edit('exempt', (current) => withMirrorArea(current, layer, undefined))
  }

  /** A handle grabbed: its Axis, or the centre, is held where it is until the drag moves it. */
  function pressAxis(axis: MirrorAxis) {
    const project = deps.currentProject()
    if (!project) return
    const placed = canvasAxesOf(project)
    if (axis === 'radial') {
      if (placed.centre) held.value = { axis, at: placed.centre }
      return
    }
    const at = placed[axis]
    if (at !== undefined) held.value = { axis, at }
  }

  /** The held handle dragged to a point of the Canvas, in its grid px: a straight Axis snaps to the nearest position
   * centre or boundary along its direction, the centre to the nearest position or corner between four. */
  function dragAxis(axis: MirrorAxis, point: { x: number; y: number }) {
    const project = deps.currentProject()
    if (!project || held.value?.axis !== axis) return
    const { weave } = layerOf(project, 'canvas')
    if (axis === 'radial') {
      held.value = { axis, at: snapCentre({ row: axisAtGridPx(weave, 'topBottom', point.y), column: axisAtGridPx(weave, 'leftRight', point.x) }) }
      return
    }
    held.value = { axis, at: snapAxis(axisAtGridPx(weave, axis, point[axis === 'leftRight' ? 'x' : 'y'])) }
  }

  /** The handle let go: the Axis or centre is saved where the drag left it, one Undo step; none when it did not move. */
  function releaseAxis() {
    const drag = held.value
    held.value = undefined
    const project = deps.currentProject()
    if (!drag || !project) return
    const placed = canvasAxesOf(project)
    if (drag.axis === 'radial') {
      if (placed.centre?.row === drag.at.row && placed.centre?.column === drag.at.column) return
      deps.edit('exempt', (current) => withCanvasAxes(current, { ...canvasAxesOf(current), centre: drag.at }))
      return
    }
    if (placed[drag.axis] === drag.at) return
    deps.edit('exempt', (current) => withCanvasAxes(current, { ...canvasAxesOf(current), [drag.axis]: drag.at }))
  }

  return {
    setting,
    on,
    limits,
    onCanvas,
    popoverOpen,
    canvasAxes,
    heldAxis,
    update,
    toggle,
    togglePopover,
    pressAxis,
    dragAxis,
    releaseAxis,
    areaRow,
    area,
    picking,
    band,
    startPick,
    cancelPick,
    pressArea,
    dragArea,
    releaseArea,
    pickWholeFrame,
    clearArea,
  }
}
