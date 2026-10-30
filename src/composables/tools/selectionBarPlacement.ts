import type { TitleCorner } from '../../rendering/marginForm'

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

/** The gap kept between the bar and the Selection's edge, and between the bar and the canvas box's edge (ticket
 * 415). */
const BAR_GAP_PX = 6
export const BAR_EDGE_PX = 8

/** Whether two boxes of the canvas box overlap: the Selection bar against the Tool pill. */
const boxesOverlap = (a: BarBox, b: BarBox) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height

// Where the Selection bar sits (ticket 415): centred above the Selection's top edge, clamped inside the canvas box,
// flipped below when there is no room above. The Tool pill's rectangle (`obstacle`, ticket 439) acts like a canvas
// edge: the bar flips sides or slides clear of the pill the way it overlaps least.
export function selectionBarPlacement(
  selection: BarBox,
  bar: { width: number; height: number },
  viewport: { width: number; height: number },
  obstacle?: BarBox,
): BarPlacement {
  const onScreen = (value: number, size: number, limit: number) => Math.max(BAR_EDGE_PX, Math.min(value, limit - size - BAR_EDGE_PX))
  const left = onScreen(selection.left + selection.width / 2 - bar.width / 2, bar.width, viewport.width)
  const above = selection.top - BAR_GAP_PX - bar.height
  const below = above < BAR_EDGE_PX
  const at = (isBelow: boolean): BarPlacement => ({
    left,
    top: onScreen(isBelow ? selection.top + selection.height + BAR_GAP_PX : above, bar.height, viewport.height),
    below: isBelow,
  })
  const preferred = at(below)
  const hits = (placement: BarPlacement) => !!obstacle && boxesOverlap({ ...placement, ...bar }, obstacle)
  if (!hits(preferred)) return preferred
  const flipped = at(!below)
  if (!hits(flipped)) return flipped
  // Neither side is clear: slide the preferred spot off the pill, the shorter way, and keep it inside the box.
  const pill = obstacle!
  const slides: BarPlacement[] = [
    { ...preferred, left: onScreen(pill.left - BAR_GAP_PX - bar.width, bar.width, viewport.width) },
    { ...preferred, left: onScreen(pill.left + pill.width + BAR_GAP_PX, bar.width, viewport.width) },
    { ...preferred, top: onScreen(pill.top - BAR_GAP_PX - bar.height, bar.height, viewport.height) },
    { ...preferred, top: onScreen(pill.top + pill.height + BAR_GAP_PX, bar.height, viewport.height) },
  ]
  const clear = slides.filter((placement) => !hits(placement))
  const distance = (placement: BarPlacement) => Math.abs(placement.left - preferred.left) + Math.abs(placement.top - preferred.top)
  return clear.sort((a, b) => distance(a) - distance(b))[0] ?? preferred
}

/** Where the Frame is on screen (tickets 427, 473, 0657): its line's box, its margin sheet's box and the canvas box
 * they sit in, in the canvas box's pixels. The sheet's tools and title block are placed from it. */
export interface FrameAnchor extends SelectionAnchor {
  /** The margin sheet round the Frame (MarginSheet card), the Frame's tools on its paper. */
  sheet: BarBox
  /** How tall the sheet's narrowest band is in screen px: what its form follows (ticket 0658). */
  band: number
  /** The Canvas's first bead cell on screen, whatever the Frame is: it moves with pan and zoom only, so what is carried with the view follows it (ticket 500). */
  origin?: BarBox
  /** The sheet's corner that holds the title block, the Frame's own bottom-right on a turned Canvas (ticket 0726): as
   * drawn before it leans. None, bottom-right. */
  titleCorner?: TitleCorner
  /** How far the Canvas leans off its quarter turn, in degrees clockwise (ticket 0672): the boxes above are as drawn
   * before it leans, and the sheet's tools lean with it about the viewport's middle. None upright. */
  tilt?: number
}

/** How far a Selection's handles reach past its edge, in screen px (a finger's 35). */
const SELECTION_HANDLE_REACH_PX = 35

/** Whether a control's hit area lies where a Selection's handles can be pressed, so the handle wins the press (tickets
 * 498, 0657): over the reach round its edge, not well inside it. */
export function overlapsSelectionHandles(hit: BarBox, selection: BarBox): boolean {
  const reach = SELECTION_HANDLE_REACH_PX
  const handles: BarBox = { left: selection.left - reach, top: selection.top - reach, width: selection.width + 2 * reach, height: selection.height + 2 * reach }
  const inside: BarBox = { left: selection.left + reach, top: selection.top + reach, width: selection.width - 2 * reach, height: selection.height - 2 * reach }
  const coveredWhole = inside.width > 0 && inside.height > 0 && hit.left >= inside.left && hit.top >= inside.top && hit.left + hit.width <= inside.left + inside.width && hit.top + hit.height <= inside.top + inside.height
  return boxesOverlap(hit, handles) && !coveredWhole
}
