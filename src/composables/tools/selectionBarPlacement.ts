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
}

/** The centre of each edge's stepper pair, in the canvas box's pixels. */
export type FrameStepperCentres = Record<'top' | 'bottom' | 'left' | 'right', { x: number; y: number }>

/**
 * Where Edit Frame's margin steppers go (ticket 427, ADR 0055): each pair centred on its edge, in the margin between the
 * ruler numbers and the margin's outer edge. They are pinned there, never clamped to the canvas box: panning carries them
 * with the Frame, and a pair off the box goes out of sight with its edge.
 */
export function frameStepperCentres(anchor: FrameAnchor): FrameStepperCentres {
  const { box, outer, numbers } = anchor
  const midX = box.left + box.width / 2
  const midY = box.top + box.height / 2
  return {
    top: { x: midX, y: (box.top - numbers.down + outer.top) / 2 },
    bottom: { x: midX, y: (box.top + box.height + numbers.down + outer.top + outer.height) / 2 },
    left: { x: (box.left - numbers.across + outer.left) / 2, y: midY },
    right: { x: (box.left + box.width + numbers.across + outer.left + outer.width) / 2, y: midY },
  }
}

/** A corner control is 26px square, 36px on touch, shrinking with the zoom like the steppers (`anchor.scale`); the four sit 4px apart, 4px inside the margin outline's corner. */
const CORNER_PX = 26
const TOUCH_CORNER_PX = 36
const CORNER_GAP_PX = 4
const CORNER_INSET_PX = 4

/** Where one corner control goes, in the canvas box's pixels: its centre. */
export type FrameCornerControls = Record<'move' | 'rotate' | 'edit' | 'remove', { x: number; y: number }> & {
  /** The scaled side of each control, in the canvas box's pixels. */
  size: number
  /** The side before the zoom, which the button keeps while its wrapper is scaled down. */
  fullSize: number
  /** The zoom factor already applied to `size`, gaps and inset (the anchor's `scale`). */
  scale: number
}

/**
 * The Frame's four corner controls (ticket 455, after 452 and 471): Move handle, Rotate Frame, Edit Frame and Remove Frame in one row, like a
 * window's buttons, just inside the margin outline's top-right corner, pinned there (not clamped to the canvas box, so panning carries it).
 */
export function frameCornerControls(anchor: FrameAnchor, touch: boolean): FrameCornerControls {
  const { outer, scale } = anchor
  const fullSize = touch ? TOUCH_CORNER_PX : CORNER_PX
  const size = fullSize * scale
  const gap = CORNER_GAP_PX * scale
  const right = outer.left + outer.width - CORNER_INSET_PX * scale
  const top = outer.top + CORNER_INSET_PX * scale
  const y = top + size / 2
  const at = (slot: number) => ({ x: right - size / 2 - slot * (size + gap), y })
  return { size, fullSize, scale, remove: at(0), edit: at(1), rotate: at(2), move: at(3) }
}

/** The height of the margin's top band the corner controls need at a zoom scale (ticket 459): a control and the inset above and below it. */
export function cornerControlsReachPx(scale: number, touch: boolean): number {
  return ((touch ? TOUCH_CORNER_PX : CORNER_PX) + 2 * CORNER_INSET_PX) * scale
}

/** The Move handle's square (ticket 452, 455): the leftmost of the corner controls. */
export function frameMoveHandle(anchor: FrameAnchor, touch: boolean): { x: number; y: number; size: number } {
  const { move, size } = frameCornerControls(anchor, touch)
  return { ...move, size }
}
