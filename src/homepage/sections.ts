// The Homepage's sections (ticket 0739; Homepage card): one at a time in the canvas box, a viewport of scroll each, the
// page snapping from one to the next.

/** The sections in order: What's inside, the coffee tile, Three ways to use it. */
export const SECTIONS = ['inside', 'coffee', 'plans'] as const

/** The section a scroll position shows: the nearest viewport's, held to the first and last past the ends (the page reaches
 * on past the last as far as the free list grows, ticket 0742). */
export function sectionAt(scrollTop: number, viewport: number): number {
  return Math.max(0, Math.min(SECTIONS.length - 1, Math.round(scrollTop / Math.max(1, viewport))))
}
