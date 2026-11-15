import type { Insets } from '../domain/toolPill'
import type { Region } from './surfaceView'

/** Air left between a panel's edge and the drawing brought beside it. */
const AIR_PX = 16

/** The least share of the drawing area's width the free side must keep for a move into it to be worth making: a
 * phone's panel spans the screen and leaves none. */
const LEAST_SHARE = 0.25

/** What a panel open over the drawing area takes from it (ticket 0971), as insets of the area: the panel and a little
 * air on its side, so the free side beside it, the wider one, is the room left. None where the panel lies off the area
 * or leaves too narrow a side. Both boxes are on the screen. */
export function roomBesidePanel(panel: Region, area: Region): Insets | undefined {
  const overlaps = panel.x < area.x + area.width && panel.x + panel.width > area.x && panel.y < area.y + area.height && panel.y + panel.height > area.y
  if (!overlaps) return undefined
  const leftRoom = panel.x - AIR_PX - area.x
  const rightRoom = area.x + area.width - (panel.x + panel.width + AIR_PX)
  const room = Math.max(leftRoom, rightRoom)
  if (room < area.width * LEAST_SHARE) return undefined
  return rightRoom >= leftRoom ? { top: 0, right: 0, bottom: 0, left: area.width - rightRoom } : { top: 0, right: area.width - leftRoom, bottom: 0, left: 0 }
}
