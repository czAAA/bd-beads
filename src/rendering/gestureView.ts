import { CELL_SIZE_PX } from './cellSize'

/** A view of the Canvas: how much it is enlarged by, and how far it has been moved, in displayed px. */
export interface View {
  zoom: number
  scroll: { x: number; y: number }
}

// Past this many square beads' worth in view, a redraw can't keep up with a pan or pinch (tickets 349, 0676), so the
// drawn bitmap is moved and scaled and redrawn sharp when the gesture settles. A loom Canvas at 100% on a 1900 × 1200
// screen (about 5,000 beads) is drawn live; at 60%, or peyote's rounded beads at 100%, it is moved. Not in the draft look.
export const GESTURE_BEAD_LIMIT = 8_000

/** How long after the last pan or zoom step the sharp redraw comes, in ms. */
export const SETTLE_MS = 120

/** How many beads a redraw has to draw: those in and outside the Frame, at most what fits the surface, each counted as
 * `cost` square beads (a rounded one is three, `draftCost`). An estimate. */
export function beadsToDraw(stored: number, frameBeads: number, surface: { width: number; height: number }, zoom: number, cost = 1): number {
  const cell = CELL_SIZE_PX * zoom
  return Math.min((surface.width / cell) * (surface.height / cell), stored + frameBeads) * cost
}

// The CSS transform (origin top-left) turning the bitmap drawn for one view into what another view shows: a point drawn
// at p was at p + scroll; scale it at the new zoom, then take the new scroll off. Same for every rotation.
export function gestureTransform(from: View, to: View): { scale: number; x: number; y: number } {
  const scale = to.zoom / from.zoom
  return { scale, x: from.scroll.x * scale - to.scroll.x, y: from.scroll.y * scale - to.scroll.y }
}
