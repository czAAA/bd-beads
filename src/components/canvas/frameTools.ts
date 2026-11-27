import { computed } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { frameAllows } from '../../domain/frameShape'
import type { FrameId } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { BAND_ORDER, type BandToolId } from '../../rendering/marginBand'
import type { FrameToolItem } from './framePopoverTools'

/** What pressing each of a Frame's tools runs, as the place that offers them does it. */
export interface FrameToolRuns {
  mirrorOn: () => boolean
  run: Record<BandToolId, () => void>
}

/** A Frame's tools, the actions they run and which it offers now: one list for the margin sheet's band, its ··· popover
 * and the expanded sheet's rail (MarginSheet card; tickets 1195, 1220, 1260). */
export function useFrameTools(project: () => Project, frame: () => FrameId, { mirrorOn, run }: FrameToolRuns) {
  const actions = {
    mirror: controlAction('mirror-frame'),
    rotate: controlAction('rotate-frame'),
    edit: controlAction('edit-frame'),
    export: controlAction('strip-export'),
    color: controlAction('margin-color'),
    remove: controlAction('remove-frame'),
  }
  /** The tools the Frame offers: Mirror the whole Frame and Rotate Frame only where it can be turned. Edit Frame stays
   * offered on a turned Frame (ticket 1016), and on one with a row done, disabled there saying why (ticket 0975). */
  const ids = computed(() => {
    const rotatable = frameAllows(project(), 'rotate', frame())
    const offered: Record<BandToolId, boolean> = { mirror: rotatable, rotate: rotatable, edit: frameAllows(project(), 'resize', frame()), export: true, color: true, remove: true }
    return BAND_ORDER.filter((id) => offered[id])
  })
  /** Every tool as an item, Mirror the whole Frame checked while on. */
  const items = computed(() => ids.value.map((id): FrameToolItem => ({ id, action: actions[id], run: run[id], ...(id === 'mirror' ? { checked: mirrorOn() } : {}) })))
  return { actions, ids, items }
}
