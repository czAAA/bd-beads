import { computed, ref } from 'vue'
import { axisLimitsOf, isMirrorOn, MIRROR_OFF, mirrorSettingOf, toggledMirror, withMirror, type MirrorMode, type MirrorSetting } from '../../domain/mirror'
import type { Project } from '../../domain/project'

/** What Mirror needs from the app shell: the open Project and its write path. A setting is not an Undo step, so it
 * goes to `replaceProject` as Letters does (ADR 0036's "outside Edit"). */
export interface MirrorFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
}

/** The Mirror mode's state (ADR 0082, spec 0702, ticket 0703): the open Project's setting, whether the tile is lit, the
 * popover, the Frame's count limits, and key `8`'s toggle, which remembers the mode it last had on. */
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
  const popoverOpen = ref(false)
  /** The mode key `8` turns back on: Mirror until Repeat has been chosen. */
  let lastMode: Exclude<MirrorMode, 'off'> = 'mirror'

  function update(next: MirrorSetting) {
    const project = deps.currentProject()
    if (!project) return
    if (next.mode !== 'off') lastMode = next.mode
    deps.replaceProject(withMirror(project, next))
  }

  function toggle() {
    update(toggledMirror(setting.value, lastMode))
  }

  function togglePopover() {
    popoverOpen.value = !popoverOpen.value
  }

  return { setting, on, limits, popoverOpen, update, toggle, togglePopover }
}
