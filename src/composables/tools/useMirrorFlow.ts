import { computed, ref } from 'vue'
import {
  axisLimitsOf,
  canvasAxesOf,
  isMirrorOn,
  MIRROR_DIRECTIONS,
  MIRROR_OFF,
  mirrorSettingOf,
  snapAxis,
  snapCentre,
  toggledMirror,
  withAxesPlaced,
  withCanvasAxes,
  withMirror,
  type CanvasAxes,
  type MirrorAxis,
  type MirrorDirection,
  type MirrorMode,
  type MirrorSetting,
  type RadialCentre,
} from '../../domain/mirror'
import { frameOf, layerOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { axisAtGridPx } from '../../rendering/mirrorAxes'
import type { EditFn } from '../project/useEdit'

/** What Mirror needs from the app shell: the open Project and its write paths, and where the view's middle is. A
 * setting is not an Undo step, so it goes to `replaceProject` as Letters does (ADR 0036's "outside Edit"); a dragged
 * Axis handle is one, through `edit` (ticket 0704). */
export interface MirrorFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  edit: EditFn
  /** The point of the Canvas, in its grid px, under the middle of the view; nothing until the view is measured. */
  viewCentre: () => { x: number; y: number } | undefined
}

/** The Mirror mode's state (ADR 0082, spec 0702, ticket 0703): the open Project's setting, whether the tile is lit, the
 * popover, the Frame's count limits, key `8`'s toggle (which remembers the mode it last had on) and the open Canvas's
 * Axis handles (ticket 0704) and Radial centre (0705): placed through the view's centre when turned on, dragged as one
 * Undo step. */
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

  /** The handle being dragged and where its Axis or the centre is as it goes, snapped, before the release saves it. */
  const held = ref<{ axis: MirrorDirection; at: number } | { axis: 'radial'; at: RadialCentre }>()
  const heldAxis = computed(() => held.value?.axis)

  /** The Canvas Axes that act: a straight one on in the setting, placed, in Mirror mode (Repeat has no strip to repeat
   * on an open Canvas, spec 0702); Radial's centre when Radial is on and placed, in either mode (a turn needs no edge,
   * ticket 0705); the one being dragged where the drag has it. The overlay draws these. */
  const canvasAxes = computed<CanvasAxes>(() => {
    const project = deps.currentProject()
    if (!project || !on.value) return {}
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

  function togglePopover() {
    popoverOpen.value = !popoverOpen.value
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

  return { setting, on, limits, onCanvas, popoverOpen, canvasAxes, heldAxis, update, toggle, togglePopover, pressAxis, dragAxis, releaseAxis }
}
