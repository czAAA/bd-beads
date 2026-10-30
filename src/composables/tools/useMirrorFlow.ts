import { computed, ref } from 'vue'
import {
  axisLimitsOf,
  canvasAxesOf,
  isMirrorOn,
  MIRROR_DIRECTIONS,
  MIRROR_OFF,
  mirrorSettingOf,
  snapAxis,
  toggledMirror,
  withAxesPlaced,
  withCanvasAxes,
  withMirror,
  type MirrorDirection,
  type MirrorMode,
  type MirrorSetting,
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
 * Axis handles (ticket 0704): placed through the view's centre when a direction goes on, dragged as one Undo step. */
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

  /** The handle being dragged and where its Axis is as it goes, snapped, before the release saves it. */
  const held = ref<{ direction: MirrorDirection; at: number }>()
  const heldAxis = computed(() => held.value?.direction)

  /** The Canvas Axes that act, by direction: on in the setting, placed, in Mirror mode (Repeat has no strip to repeat
   * on an open Canvas, spec 0702); the one being dragged where the drag has it. The overlay draws these. */
  const canvasAxes = computed<Partial<Record<MirrorDirection, number>>>(() => {
    const project = deps.currentProject()
    if (!project || setting.value.mode !== 'mirror') return {}
    const placed = canvasAxesOf(project)
    const acting: Partial<Record<MirrorDirection, number>> = {}
    for (const direction of MIRROR_DIRECTIONS) {
      const at = held.value?.direction === direction ? held.value.at : placed[direction]
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

  /** A handle grabbed: its Axis is held where it is until the drag moves it. */
  function pressAxis(direction: MirrorDirection) {
    const project = deps.currentProject()
    const at = project && canvasAxesOf(project)[direction]
    if (at === undefined) return
    held.value = { direction, at }
  }

  /** The held handle dragged to a point of the Canvas, in grid px along its direction: the Axis snaps to the nearest
   * position centre or boundary there. */
  function dragAxis(direction: MirrorDirection, px: number) {
    const project = deps.currentProject()
    if (!project || held.value?.direction !== direction) return
    held.value = { direction, at: snapAxis(axisAtGridPx(layerOf(project, 'canvas').weave, direction, px)) }
  }

  /** The handle let go: the Axis is saved where the drag left it, one Undo step; none when it did not move. */
  function releaseAxis() {
    const drag = held.value
    held.value = undefined
    const project = deps.currentProject()
    if (!drag || !project || canvasAxesOf(project)[drag.direction] === drag.at) return
    deps.edit('exempt', (current) => withCanvasAxes(current, { ...canvasAxesOf(current), [drag.direction]: drag.at }))
  }

  return { setting, on, limits, onCanvas, popoverOpen, canvasAxes, heldAxis, update, toggle, togglePopover, pressAxis, dragAxis, releaseAxis }
}
