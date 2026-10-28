import { describeWeave, type BeadCell, type Technique } from '../domain/weave'
import type { Size } from './surfaceView'

// Apart from the Surface view so the Custom frame's view can size its beads without importing it back (ticket 0620).

// The pixel size a bead is drawn at, at zoom 1 (the Project renderer's own size), so every layer lines up with what is
// drawn.
export const CELL_SIZE_PX = 20

/** A bead's cell in grid px: square, except where the Technique draws beads longer than they are wide (ticket 482) or
 * the Bead shape is Real, which draws the Bead's own proportions (ADR 0068). */
export function cellSizePx(technique: Technique, cell?: BeadCell): Size {
  return { width: CELL_SIZE_PX, height: CELL_SIZE_PX * describeWeave({ technique, cell }).cellAspect }
}
