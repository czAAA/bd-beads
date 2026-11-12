import { turnedExtent } from '../../domain/referenceImage'

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
const within = (at: number, size: number, room: number) => Math.max(EDGE_PX, Math.min(room - size - EDGE_PX, at))

/** The bar's top-left: centred over the picture, its bottom 14px above the top edge, or above the Frame's margin sheet
 * where the picture lies under it; with no room there, 14px inside the picture's top edge as it shows (below is the
 * Turn handle's and the Tool pill's). Kept inside the canvas box. */
export function pictureBarPlace(picture: ScreenBox, bar: { width: number; height: number }, viewport: { width: number; height: number }, sheet?: ScreenBox): { left: number; top: number } {
  const under = sheet && overlaps(picture, sheet) ? sheet : undefined
  const above = Math.min(picture.top, under?.top ?? Infinity) - BAR_GAP_PX - bar.height
  const top = above >= EDGE_PX ? above : Math.max(picture.top, 0) + BAR_GAP_PX
  return { left: within(picture.left + picture.width / 2 - bar.width / 2, bar.width, viewport.width), top: within(top, bar.height, viewport.height) }
}

/** The popover's top-left: 20px right of the picture, or left of it where there is no room, its top level with the
 * bar's; kept inside the canvas box. */
export function convertPopoverPlace(picture: ScreenBox, barTop: number, popover: { width: number; height: number }, viewport: { width: number; height: number }): { left: number; top: number } {
  const right = picture.left + picture.width + POPOVER_GAP_PX
  const left = right + popover.width + EDGE_PX <= viewport.width ? right : picture.left - POPOVER_GAP_PX - popover.width
  return { left: within(left, popover.width, viewport.width), top: within(barTop, popover.height, viewport.height) }
}
