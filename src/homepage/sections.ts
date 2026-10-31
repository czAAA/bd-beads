import type { Component } from 'vue'

// The Homepage's sections (tickets 0739, 0744; Homepage card): one at a time in the canvas box, a viewport of scroll
// each, the page snapping from one to the next.

/** A Homepage section, as the page and its Progress bar need it: the page draws it, the bar names its step. */
export interface HomepageSection {
  /** What finds it, never its place: the page's code looks for the plans by `plans`. */
  id: string
  /** Its heading, which is also its step's name on the Progress bar. */
  heading: string
  /** Where its heading shows: over it as the section's title, inside what it shows, or only to screen readers. */
  title: 'above' | 'inside' | 'hidden'
  /** Whether what it shows stands in the middle of its room. */
  centred?: boolean
  /** What it shows, and the props and listeners that takes, read as the page draws it. */
  shows: Component
  with?: () => Record<string, unknown>
}

/** The section a scroll position shows: the nearest viewport's, held to the first and last past the ends (the page reaches
 * on past the last as far as the free list grows, ticket 0742). */
export function sectionAt(scrollTop: number, viewport: number, count: number): number {
  return Math.max(0, Math.min(count - 1, Math.round(scrollTop / Math.max(1, viewport))))
}
