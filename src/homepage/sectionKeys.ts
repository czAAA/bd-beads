// The keys that turn the Homepage (tickets 0784, 0801; Homepage card, the scroll story): the keys a page scrolls by,
// each a step or a page of a section taller than its room, or a turn once it is at its end.

import type { Way } from './wheelTurn'

/** What a key asks of the Homepage: a step or a page down (1) or up (-1), or the first or last section. */
export type KeyMove = { way: Way; by: 'step' | 'page' } | { to: 'first' | 'last' }

/** What a key asks of the Homepage, if anything: Space scrolls as Page Down does, and with Shift as Page Up. */
export function keyMove(event: { key: string; shiftKey: boolean }): KeyMove | undefined {
  switch (event.key) {
    case 'ArrowDown':
      return { way: 1, by: 'step' }
    case 'ArrowUp':
      return { way: -1, by: 'step' }
    case 'PageDown':
      return { way: 1, by: 'page' }
    case 'PageUp':
      return { way: -1, by: 'page' }
    case ' ':
      return { way: event.shiftKey ? -1 : 1, by: 'page' }
    case 'Home':
      return { to: 'first' }
    case 'End':
      return { to: 'last' }
    default:
      return undefined
  }
}

/** How far a key scrolls a section taller than its room, in px: an arrow a step, a page most of the room. */
export function keyScroll(by: 'step' | 'page', room: number): number {
  return by === 'step' ? KEY_STEP : Math.max(KEY_STEP, room * PAGE_SHARE)
}

/** An arrow's step, in px, as a browser scrolls by one. */
const KEY_STEP = 40
/** How much of the room a page is, so a line of the last page stays in sight. */
const PAGE_SHARE = 0.85
