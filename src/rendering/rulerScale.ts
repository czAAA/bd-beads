/**
 * How the rulers' own parts scale with the zoom (Rulers card, ticket 377), so they look alike at every zoom: the lines
 * stay close to the beads when zoomed out and keep clear of them when zoomed in, the numbers stay readable far out and
 * grow with the beads close up, and the dots grow so they are still seen. At zoom 1 every value is the base one.
 */

/** How far a Frame's line sits outside its outermost beads at zoom 1 (Frame card). */
const FRAME_OUTSET_PX = 7
/** How far a piece's rectangle sits outside its outermost beads at zoom 1 (BeadBoard card). */
const PIECE_OUTSET_PX = 5
/** The gap between a ruler number and the line it hangs from at zoom 1 (Rulers card). */
const GAP_PX = 3
/** A Ruler dot's radius at zoom 1, and a 5th one's (Rulers card). */
const DOT_RADIUS_PX = 1
const FIFTH_DOT_RADIUS_PX = 1.75

/** The zooms (as powers of 2) between which values change; beyond them the value stays: 12.5% and 400%. */
const FAR = -3
const NEAR = 2

/** `far` at 12.5% zoom and below, `one` at 100%, `near` at 400% and above, steady in between in the zoom's own steps. */
function across(zoom: number, far: number, one: number, near: number): number {
  const power = Math.min(NEAR, Math.max(FAR, Math.log2(Math.max(zoom, 1e-6))))
  return power <= 0 ? far + (one - far) * ((power - FAR) / -FAR) : one + (near - one) * (power / NEAR)
}

/** What the rulers' parts measure at one zoom, in viewport px. */
export interface RulerScale {
  /** The numbers' size. */
  fontPx: number
  frameOutset: number
  pieceOutset: number
  /** The gap between the numbers and the line they hang from. */
  gap: number
  dotRadius: number
  fifthDotRadius: number
}

/** The line of a Frame, off its beads, at this zoom: the Frame's handles and presses use it too. */
export function frameOutsetPx(zoom: number): number {
  return FRAME_OUTSET_PX * across(zoom, 0.45, 1, 2)
}

/** The rulers' parts at this zoom; `fontPx` is the numbers' size at zoom 1 (11, or 12 on a phone). */
export function rulerScale(zoom: number, fontPx: number): RulerScale {
  return {
    fontPx: fontPx * across(zoom, 1.3, 1, 1.6),
    frameOutset: frameOutsetPx(zoom),
    pieceOutset: PIECE_OUTSET_PX * across(zoom, 0.45, 1, 2),
    gap: GAP_PX * across(zoom, 1, 1, 3),
    dotRadius: DOT_RADIUS_PX * across(zoom, 1, 1, 2.5),
    fifthDotRadius: FIFTH_DOT_RADIUS_PX * across(zoom, 1, 1, 2.5),
  }
}
