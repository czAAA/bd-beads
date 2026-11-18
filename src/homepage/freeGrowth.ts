// The No account tile's free list growing with the page's scroll (ticket 0742; Homepage card, the free list): the rule
// of the signed-off canvas "bd-beads — forever free tile", in the plans section's own px.

/** Where the list sits and how tall it is, measured with the page at the plans: what the growth is worked out from. */
export interface FreeListMeasure {
  /** The room the plans are shown in: the "screen" the tile grows down. */
  viewport: number
  /** Where the list starts, from the room's top. */
  top: number
  /** The rows it starts with (`freeStartRows`): their height, all the tile shows before the page is scrolled. */
  start: number
  /** The whole list's height. */
  full: number
  /** The tile's padding under the list. */
  below: number
}

/** The room kept clear under the tile at the screen's foot.
 * @internal Exported for the browser test, which checks the tile's foot keeps it. */
export const FOOT_ROOM = 40
/** `--free-growth`: how many times as fast as the page the tile grows, until its foot reaches the screen's. */
export const FREE_GROWTH = 2.5
/** `--free-start-rows`: the fewest rows the tile shows before the page is scrolled (ticket 1060). */
export const FREE_START_ROWS = 4

/** Where the list would stand in its room before the page is scrolled: what the rows it starts with are worked out from. */
export type FreeListPlace = Pick<FreeListMeasure, 'viewport' | 'top' | 'below'>

/** How many rows the tile starts with (ticket 1060): as many whole rows as fit above the room kept clear at the screen's
 * foot, never fewer than `least`, and never more than the list has. `rowBottoms` are each row's foot, from the list's top. */
export function freeStartRows(place: FreeListPlace, rowBottoms: readonly number[], least = FREE_START_ROWS): number {
  const room = place.viewport - FOOT_ROOM - place.top - place.below
  const fit = rowBottoms.findIndex((bottom) => bottom > room + 0.5)
  return Math.min(rowBottoms.length, Math.max(least, fit === -1 ? rowBottoms.length : fit))
}

/** How far the tile's foot can run down before it reaches the screen's. */
function gapBelow(m: FreeListMeasure): number {
  return Math.max(0, m.viewport - FOOT_ROOM - m.top - m.start - m.below)
}

/** The list's height once the page is `scroll` past the plans: growing `growth` times as fast as the page while its foot
 * runs down the screen, then as fast as the page, so it stays screen-tall, until the whole list is out. */
export function freeListHeight(m: FreeListMeasure, scroll: number, growth = FREE_GROWTH): number {
  const gap = gapBelow(m)
  const s = Math.max(0, scroll)
  const grown = s <= gap / (growth - 1) ? growth * s : gap + s
  return Math.min(m.full, m.start + grown)
}

/** How far past the plans the page scrolls: until the whole list is out and the tile's foot stands clear of the screen's. */
export function freeListRoom(m: FreeListMeasure): number {
  return Math.max(0, m.top + m.full + m.below + FOOT_ROOM - m.viewport)
}
