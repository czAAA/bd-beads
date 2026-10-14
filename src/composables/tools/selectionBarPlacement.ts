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

/** The gap between the Frame's line and Edit Frame's margin steppers, in px (EditFrameSteppers reads it from here); a stepper is `--selbar-height` square, 28px or 36px on touch. */
export const STEPPER_GAP_PX = 16
export const TOUCH_STEPPER_GAP_PX = 24
const STEPPER_REACH_PX = STEPPER_GAP_PX + 28
const TOUCH_STEPPER_REACH_PX = TOUCH_STEPPER_GAP_PX + 36

/**
 * What Edit Frame's bar anchors to (ticket 417): the Frame grown by the margin steppers' reach above and below, so the bar
 * sits just above the top stepper, and when it flips below the Frame, under the bottom one.
 */
export function frameBarAnchor(frame: SelectionAnchor, touch: boolean): SelectionAnchor {
  const reach = touch ? TOUCH_STEPPER_REACH_PX : STEPPER_REACH_PX
  const { left, top, width, height } = frame.box
  return { box: { left, top: top - reach, width, height: height + 2 * reach }, viewport: frame.viewport }
}
