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

const overlaps = (a: BarBox, b: BarBox) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height

/**
 * Where the Selection bar sits (ticket 415): centred above the Selection's top edge, clamped inside the canvas box on
 * every side, and flipped below the Selection when there is no room above. `selection` is the Selection's rectangle in
 * the canvas box's pixels, `bar` the bar's own size, `viewport` the canvas box's size. The Tool pill's rectangle
 * (`obstacle`, ticket 439) is treated like a canvas edge: the bar flips to the other side of the Selection or, failing
 * that, slides clear of the pill along the way it overlaps least.
 */
export function selectionBarPlacement(
  selection: BarBox,
  bar: { width: number; height: number },
  viewport: { width: number; height: number },
  obstacle?: BarBox,
): BarPlacement {
  const clamp = (value: number, size: number, limit: number) => Math.max(BAR_EDGE_PX, Math.min(value, limit - size - BAR_EDGE_PX))
  const left = clamp(selection.left + selection.width / 2 - bar.width / 2, bar.width, viewport.width)
  const above = selection.top - BAR_GAP_PX - bar.height
  const below = above < BAR_EDGE_PX
  const at = (isBelow: boolean): BarPlacement => ({
    left,
    top: clamp(isBelow ? selection.top + selection.height + BAR_GAP_PX : above, bar.height, viewport.height),
    below: isBelow,
  })
  const preferred = at(below)
  const hits = (placement: BarPlacement) => !!obstacle && overlaps({ ...placement, ...bar }, obstacle)
  if (!hits(preferred)) return preferred
  const flipped = at(!below)
  if (!hits(flipped)) return flipped
  // Neither side is clear: slide the preferred spot off the pill, the shorter way, and keep it inside the box.
  const pill = obstacle!
  const slides: BarPlacement[] = [
    { ...preferred, left: clamp(pill.left - BAR_GAP_PX - bar.width, bar.width, viewport.width) },
    { ...preferred, left: clamp(pill.left + pill.width + BAR_GAP_PX, bar.width, viewport.width) },
    { ...preferred, top: clamp(pill.top - BAR_GAP_PX - bar.height, bar.height, viewport.height) },
    { ...preferred, top: clamp(pill.top + pill.height + BAR_GAP_PX, bar.height, viewport.height) },
  ]
  const clear = slides.filter((placement) => !hits(placement))
  const distance = (placement: BarPlacement) => Math.abs(placement.left - preferred.left) + Math.abs(placement.top - preferred.top)
  return clear.sort((a, b) => distance(a) - distance(b))[0] ?? preferred
}

/** Where the Frame is while it is edited (ticket 427): its line's box, the margin's outer edge and how far the ruler numbers reach past the line. */
export interface FrameAnchor extends SelectionAnchor {
  /** The margin's outer edge, in the canvas box's pixels. */
  outer: BarBox
  /** How far the ruler numbers reach past the Frame's line: their width on the left and right, their height above and below. */
  numbers: { across: number; down: number }
  /** How much the steppers shrink at this zoom, 0.5 to 1 (ticket 427). */
  scale: number
  /** True when the margin steppers have no room at this zoom (the rulers show fewer than every 5th number, ticket 452). */
  steppersHidden?: boolean
}

/** A margin stepper is `--selbar-height` square, 28px or 36px on touch, and the two of a pair sit `--space-2` (2px) apart. */
const STEPPER_PX = 28
const TOUCH_STEPPER_PX = 36
const STEPPER_PAIR_GAP_PX = 2

/** A centre kept `BAR_EDGE_PX` clear of the canvas box's edges for a control `extent` long. */
const clamp = (value: number, extent: number, limit: number) => Math.max(BAR_EDGE_PX + extent / 2, Math.min(value, limit - BAR_EDGE_PX - extent / 2))

/** The centre of each edge's stepper pair, in the canvas box's pixels. */
export type FrameStepperCentres = Record<'top' | 'bottom' | 'left' | 'right', { x: number; y: number }>

/**
 * Where Edit Frame's margin steppers go (ticket 427, ADR 0055): each pair centred on its edge, in the margin between the
 * ruler numbers and the margin's outer edge, then clamped so the whole pair stays inside the canvas box.
 */
export function frameStepperCentres(anchor: FrameAnchor, touch: boolean): FrameStepperCentres {
  const { box, outer, numbers, viewport } = anchor
  const size = (touch ? TOUCH_STEPPER_PX : STEPPER_PX) * anchor.scale
  const pair = 2 * size + STEPPER_PAIR_GAP_PX * anchor.scale
  const midX = box.left + box.width / 2
  const midY = box.top + box.height / 2
  const topY = (box.top - numbers.down + outer.top) / 2
  const bottomY = (box.top + box.height + numbers.down + outer.top + outer.height) / 2
  const leftX = (box.left - numbers.across + outer.left) / 2
  const rightX = (box.left + box.width + numbers.across + outer.left + outer.width) / 2
  const across = (x: number) => clamp(x, size, viewport.width)
  const down = (y: number) => clamp(y, size, viewport.height)
  return {
    top: { x: clamp(midX, pair, viewport.width), y: down(topY) },
    bottom: { x: clamp(midX, pair, viewport.width), y: down(bottomY) },
    left: { x: across(leftX), y: clamp(midY, pair, viewport.height) },
    right: { x: across(rightX), y: clamp(midY, pair, viewport.height) },
  }
}

/** A corner control is 26px square, 36px on touch, shrinking with the zoom like the steppers (`anchor.scale`); the three sit 4px apart, 4px inside the margin outline's corner. */
const CORNER_PX = 26
const TOUCH_CORNER_PX = 36
const CORNER_GAP_PX = 4
const CORNER_INSET_PX = 4

/** Where one corner control goes, in the canvas box's pixels: its centre. */
export type FrameCornerControls = Record<'move' | 'edit' | 'remove', { x: number; y: number }> & {
  /** The scaled side of each control, in the canvas box's pixels. */
  size: number
  /** The side before the zoom, which the button keeps while its wrapper is scaled down. */
  fullSize: number
  /** The zoom factor already applied to `size`, gaps and inset (the anchor's `scale`). */
  scale: number
}

/**
 * The Frame's three corner controls (ticket 455, after 452): Move handle, Edit Frame and Remove Frame in one row, like a
 * window's buttons, just inside the margin outline's top-right corner, the row kept inside the canvas box.
 */
export function frameCornerControls(anchor: FrameAnchor, touch: boolean): FrameCornerControls {
  const { outer, viewport } = anchor
  const { scale } = anchor
  const fullSize = touch ? TOUCH_CORNER_PX : CORNER_PX
  const size = fullSize * scale
  const gap = CORNER_GAP_PX * scale
  const row = 3 * size + 2 * gap
  const right = Math.max(BAR_EDGE_PX + row, Math.min(outer.left + outer.width - CORNER_INSET_PX * scale, viewport.width - BAR_EDGE_PX))
  const top = Math.max(BAR_EDGE_PX, Math.min(outer.top + CORNER_INSET_PX * scale, viewport.height - BAR_EDGE_PX - size))
  const y = top + size / 2
  const at = (slot: number) => ({ x: right - size / 2 - slot * (size + gap), y })
  return { size, fullSize, scale, remove: at(0), edit: at(1), move: at(2) }
}

/** The Move handle's square (ticket 452, 455): the leftmost of the corner controls. */
export function frameMoveHandle(anchor: FrameAnchor, touch: boolean): { x: number; y: number; size: number } {
  const { move, size } = frameCornerControls(anchor, touch)
  return { ...move, size }
}
