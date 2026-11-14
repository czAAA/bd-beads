import { normalizeHex } from './color'
import type { Background } from './project'

// A layer's Background as stored (ADR 0079, ticket 0666): a position in the theme's list, or a Custom color.

/** How many backgrounds each theme lists, the highest position a layer can hold (CanvasBackground card, ticket 1000). */
export const BACKGROUND_POSITIONS = 3

/** How many backgrounds each theme listed before ticket 1000: the highest position an earlier build stored. */
const EARLIER_POSITIONS = 5

/** Where each of the five earlier positions went (ticket 1000, CanvasBackground card), one map for both themes: Linen
 * to Stone, Midnight to Ink, Fog to Studio, Ash to Night; Stone, Ink, Pebble and Slate keep their color. */
const NEAREST_KEPT: readonly number[] = [1, 2, 2, 1, 3]

/** The position today for one of the five an earlier build stored (1 to 5). */
export function nearestKept(earlier: number): number {
  return NEAREST_KEPT[earlier - 1] ?? 1
}

/** Whether a stored number is a whole position 1 to `positions`. */
function isPosition(stored: number, positions: number): boolean {
  return Number.isInteger(stored) && stored >= 1 && stored <= positions
}

/** A stored position read, from today's list of three or, `earlier`, from the list of five an earlier build stored,
 * moved to its nearest kept one; none for anything else. */
export function readPosition(stored: number, earlier = false): number | undefined {
  if (!earlier) return isPosition(stored, BACKGROUND_POSITIONS) ? stored : undefined
  return isPosition(stored, EARLIER_POSITIONS) ? nearestKept(stored) : undefined
}

/** A stored Background read: a position (from the list of five where `earlier`, moved), or a Custom color as
 * `#rrggbb`, never moved; none for anything else, which shows as a layer saved before it had one. */
export function readBackground(stored: unknown, earlier = false): Background | undefined {
  if (typeof stored === 'number') return readPosition(stored, earlier)
  return typeof stored === 'string' ? normalizeHex(stored) : undefined
}
