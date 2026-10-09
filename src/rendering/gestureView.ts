import { CELL_SIZE_PX } from './surfaceView'

/** A view of the open canvas: how much it is enlarged by, and how far it has been moved, in displayed px. */
export interface View {
  zoom: number
  scroll: { x: number; y: number }
}

/**
 * Past this many beads in view, a redraw is too slow to keep up with a pan or pinch (ticket 349), so the beads drawn
 * already are moved and scaled instead, and drawn sharp once the gesture settles. About a 150 × 30 piece (4,500 beads)
 * stays well under it, so the pieces people make today are drawn live exactly as before.
 */
export const GESTURE_BEAD_LIMIT = 20_000

/** How long after the last pan or zoom step the sharp redraw comes, in ms. */
export const SETTLE_MS = 120

/**
 * How many beads a redraw has to draw: those in the Frame and those stored outside it, at most as many as fit in the
 * surface at this zoom. An estimate; it only decides between drawing live and moving the bitmap.
 */
export function beadsToDraw(stored: number, frameBeads: number, surface: { width: number; height: number }, zoom: number): number {
  const cell = CELL_SIZE_PX * zoom
  return Math.min((surface.width / cell) * (surface.height / cell), stored + frameBeads)
}

/**
 * The CSS transform (origin at the top-left) that turns the bitmap drawn for one view into what another view shows.
 * A point drawn at screen position p was at displayed position p + scroll; at the new zoom that is scaled, then the new
 * scroll is taken off again. The same for every rotation, since the displayed space is scaled alike either way.
 */
export function gestureTransform(from: View, to: View): { scale: number; x: number; y: number } {
  const scale = to.zoom / from.zoom
  return { scale, x: from.scroll.x * scale - to.scroll.x, y: from.scroll.y * scale - to.scroll.y }
}
