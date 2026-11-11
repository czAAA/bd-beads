// The handle (Handle card, ticket 0867): one look and one reach for every resize handle, the Frame's, a Selection's,
// the Mirror's Area's, the converter's crop and the reference image's. The canvas draws it from these, AppHandle from
// their CSS twins in design-values.css and bundle.css, which handleSizes.test.ts holds equal to them.

/** The handle's screen px. */
export const HANDLE_PX = {
  /** A corner's bracket: two arms along the edges, `line` thick, the corner rounded, standing `offset` outside the line. */
  bracket: { arm: 14, line: 3, radius: 4, offset: 3 },
  /** The corner under the pointer or being dragged: longer, thicker arms on a disc of `disc` radius. */
  hot: { arm: 18, line: 4, disc: 16 },
  /** An edge's bar at its middle, just outside the line. */
  bar: { length: 12, thickness: 4 },
  /** How far from its centre a press grabs it: a mouse or pen's, and a finger's, half the 44px `touch-target`. */
  reach: { fine: 14, touch: 22 },
} as const

/** The most a handle's reach may be on a rectangle on screen: a third of its shorter side, so a small one keeps an
 * inside to move. */
export function reachLimit(box: { width: number; height: number }): number {
  return Math.min(box.width, box.height) / 3
}

/** How strongly the hot corner's disc is filled with the handle's colour. */
export const HANDLE_HOT_DISC_ALPHA = 0.18
