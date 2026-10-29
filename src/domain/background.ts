import { normalizeHex } from './color'
import type { Background } from './project'

// A layer's Background as stored (ADR 0079, ticket 0666): a position in the theme's list, or a Custom color.

/** How many backgrounds each theme lists, the highest position a layer can hold (CanvasBackground card). */
export const BACKGROUND_POSITIONS = 5

/** A stored Background read: a whole position 1 to 5, or a Custom color as `#rrggbb`; none for anything else, which
 * shows as a layer saved before it had one. */
export function readBackground(stored: unknown): Background | undefined {
  if (typeof stored === 'number') return Number.isInteger(stored) && stored >= 1 && stored <= BACKGROUND_POSITIONS ? stored : undefined
  return typeof stored === 'string' ? normalizeHex(stored) : undefined
}
