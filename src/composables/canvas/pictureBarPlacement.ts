import { clamp } from '../../domain/clamp'
import { turnedExtent } from '../../domain/referenceImage'
import { BAR_STICK_PX } from '../tools/selectionBarPlacement'

// Where the reference image's picture bar and its Convert to beads popover stand on the canvas box (ReferenceImage card,
// ticket 0883), in screen px: the bar over the picture's top edge, level, the popover beside the picture.

/** A box on the canvas box, in its px. */
export interface ScreenBox {
  left: number
  top: number
  width: number
  height: number
}

/** The picture as it lies on screen: its centre, size and angle (rendering/referenceImage's placeOnScreen). */
interface OnScreen {
  centre: { x: number; y: number }
  width: number
  height: number
  angle: number
}

/** How far the bar's bottom stands above the picture's top edge, or the margin sheet's, and the popover off its side. */
const BAR_GAP_PX = 14
const POPOVER_GAP_PX = 20
/** The least room kept between the bar or popover and the canvas box's edge. */
const EDGE_PX = 8

/** The box round the picture as it lies on screen, turned. */
export function pictureBounds({ centre, width, height, angle }: OnScreen): ScreenBox {
  const extent = turnedExtent(width, height, angle)
  return { left: centre.x - extent.width / 2, top: centre.y - extent.height / 2, ...extent }
}

const overlaps = (a: ScreenBox, b: ScreenBox) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height
const within = (at: number, size: number, room: number) => clamp(at, EDGE_PX, room - size - EDGE_PX)

/** The bar's top-left: centred over the picture, 14px above its top edge or its Frame's margin sheet, else 14px inside
 * the top edge as it shows. Kept in the canvas box only while on the picture (ticket 1011): 24px over it across, no
 * lower than 14px inside its bottom edge; a picture panned away takes it along. */
export function pictureBarPlace(picture: ScreenBox, bar: { width: number; height: number }, viewport: { width: number; height: number }, sheet?: ScreenBox): { left: number; top: number } {
  const under = sheet && overlaps(picture, sheet) ? sheet : undefined
  const above = Math.min(picture.top, under?.top ?? Infinity) - BAR_GAP_PX - bar.height
  const top = above >= EDGE_PX ? above : Math.max(picture.top, 0) + BAR_GAP_PX
  const stick = Math.min(BAR_STICK_PX, picture.width / 2)
  const left = within(picture.left + picture.width / 2 - bar.width / 2, bar.width, viewport.width)
  const lowest = Math.max(above, picture.top + BAR_GAP_PX, picture.top + picture.height - BAR_GAP_PX - bar.height)
  return {
    left: clamp(left, picture.left + stick - bar.width, picture.left + picture.width - stick),
    top: clamp(within(top, bar.height, viewport.height), above, lowest),
  }
}

/** How far from `from` a handle stands along `way` (a unit vector) to keep `clear` px off the bar: `least`, or on past
 * the bar's box where `least` would land it on the bar (ticket 1160), leaving by the side its way reaches first. */
export function reachClearOf(from: { x: number; y: number }, way: { x: number; y: number }, least: number, bar: ScreenBox | undefined, clear: number): number {
  if (!bar) return least
  const [left, top, right, bottom] = [bar.left - clear, bar.top - clear, bar.left + bar.width + clear, bar.top + bar.height + clear]
  const at = { x: from.x + way.x * least, y: from.y + way.y * least }
  if (at.x <= left || at.x >= right || at.y <= top || at.y >= bottom) return least
  const across = way.x > 0 ? (right - from.x) / way.x : way.x < 0 ? (left - from.x) / way.x : Infinity
  const along = way.y > 0 ? (bottom - from.y) / way.y : way.y < 0 ? (top - from.y) / way.y : Infinity
  return Math.min(across, along)
}

/** The popover's top-left: 20px right of the picture, or left of it where there is no room, its top level with the
 * bar's; kept inside the canvas box. */
export function convertPopoverPlace(picture: ScreenBox, barTop: number, popover: { width: number; height: number }, viewport: { width: number; height: number }): { left: number; top: number } {
  const right = picture.left + picture.width + POPOVER_GAP_PX
  const left = right + popover.width + EDGE_PX <= viewport.width ? right : picture.left - POPOVER_GAP_PX - popover.width
  return { left: within(left, popover.width, viewport.width), top: within(barTop, popover.height, viewport.height) }
}
