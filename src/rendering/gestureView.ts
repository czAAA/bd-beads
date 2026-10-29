import { CELL_SIZE_PX } from './cellSize'
import type { Scroll, SurfaceView } from './surfaceView'
import type { TiltedView } from './tiltedView'

/** A drawing of the Canvas (ticket 0709): how the grid maps onto it, and how it leans on the screen. */
export interface DrawnView {
  surface: Pick<SurfaceView, 'gridToPoint'>
  leaning: Pick<TiltedView, 'toScreen' | 'offset'>
}

/** A plane transform as CSS `matrix(a, b, c, d, e, f)` takes it: x' = ax + cy + e, y' = bx + dy + f. */
export interface Affine {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

/** The transform (origin the drawing's top-left) laying the drawing made for one view, held while two fingers twist,
 * where another view shows the same beads (ticket 0709). The grid points (0, 0), (1, 0) and (0, 1) fix it: both views
 * map the grid by a quarter turn, a zoom and a scroll, and the screen turns the second by its lean. */
export function twistTransform(from: DrawnView, to: DrawnView): Affine {
  const drawn = (x: number, y: number): Scroll => from.surface.gridToPoint(x, y)
  const shown = (x: number, y: number): Scroll => to.leaning.toScreen(to.surface.gridToPoint(x, y))
  const [p0, p1, p2] = [drawn(0, 0), drawn(1, 0), drawn(0, 1)]
  const [s0, s1, s2] = [shown(0, 0), shown(1, 0), shown(0, 1)]
  // M = B · A⁻¹, A the drawn grid axes, B the shown ones.
  const A = { a: p1.x - p0.x, b: p1.y - p0.y, c: p2.x - p0.x, d: p2.y - p0.y }
  const B = { a: s1.x - s0.x, b: s1.y - s0.y, c: s2.x - s0.x, d: s2.y - s0.y }
  const det = A.a * A.d - A.b * A.c
  const inverse = { a: A.d / det, b: -A.b / det, c: -A.c / det, d: A.a / det }
  const a = B.a * inverse.a + B.c * inverse.b
  const b = B.b * inverse.a + B.d * inverse.b
  const c = B.a * inverse.c + B.c * inverse.d
  const d = B.b * inverse.c + B.d * inverse.d
  // The drawing's box sits `offset` above and left of the screen, so the screen point is measured from there.
  const e = s0.x - (a * p0.x + c * p0.y) + from.leaning.offset.x
  const f = s0.y - (b * p0.x + d * p0.y) + from.leaning.offset.y
  return { a, b, c, d, e, f }
}

/** A view of the Canvas: how much it is enlarged by, and how far it has been moved, in displayed px. */
export interface View {
  zoom: number
  scroll: { x: number; y: number }
}

// Past this many square beads' worth in view, a redraw can't keep up with a pan or pinch (tickets 349, 0676, 0689),
// so the drawn bitmap is moved and scaled, in the draft look too, and redrawn sharp when the gesture settles. A loom
// Canvas at 100% on a 1900 × 1200 screen (about 5,000 beads) is drawn live; at 60%, or rounded beads at 100%, moved.
export const GESTURE_BEAD_LIMIT = 8_000

/** How long after the last pan or zoom step the sharp redraw comes, in ms. */
export const SETTLE_MS = 120

/** How long a twist takes to ease onto the quarter turn it snaps to as the fingers lift, in ms (ticket 0709): the
 * design system's base duration, which the drawing's transition uses too (shorter under reduced motion, where the
 * sharp redraw waits the rest). */
export const SNAP_MS = 200

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
