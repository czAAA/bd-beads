/** A rectangle in the canvas box's own pixels. */
export interface BarBox {
  left: number
  top: number
  width: number
  height: number
}

/** Where the Selection is on the canvas box, and how big that box is: what the bar anchors to (ticket 415). */
export interface SelectionAnchor {
  box: BarBox
  viewport: { width: number; height: number }
}

/** Where the Selection bar goes and which side of the Selection it is on. */
export interface BarPlacement {
  left: number
  top: number
  below: boolean
}

/** The gap kept between the bar and the Selection's edge, and between the bar and the canvas box's edge (ticket 415). */
const BAR_GAP_PX = 6
export const BAR_EDGE_PX = 8

/**
 * Where the Selection bar sits (ticket 415): centred above the Selection's top edge, clamped inside the canvas box on
 * every side, and flipped below the Selection when there is no room above. `selection` is the Selection's rectangle in
 * the canvas box's pixels, `bar` the bar's own size, `viewport` the canvas box's size.
 */
export function selectionBarPlacement(selection: BarBox, bar: { width: number; height: number }, viewport: { width: number; height: number }): BarPlacement {
  const clamp = (value: number, size: number, limit: number) => Math.max(BAR_EDGE_PX, Math.min(value, limit - size - BAR_EDGE_PX))
  const left = clamp(selection.left + selection.width / 2 - bar.width / 2, bar.width, viewport.width)
  const above = selection.top - BAR_GAP_PX - bar.height
  const below = above < BAR_EDGE_PX
  const top = clamp(below ? selection.top + selection.height + BAR_GAP_PX : above, bar.height, viewport.height)
  return { left, top, below }
}
