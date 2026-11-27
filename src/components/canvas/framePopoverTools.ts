import type { controlAction } from '../../composables/shell/controlRegistry'
import type { BandToolId } from '../../rendering/marginBand'

/** One tool of the Frame settings popover: its action, what pressing it runs, and Mirror the whole Frame's check. */
export interface FrameToolItem {
  id: BandToolId
  action: ReturnType<typeof controlAction>
  run: () => void
  checked?: boolean
}
