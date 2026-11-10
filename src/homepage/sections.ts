import type { Component } from 'vue'

// The Homepage's sections (tickets 0739, 0744, 0801; Homepage card): one at a time in the canvas box, turned by every
// way of scrolling.

/** A Homepage section, as the page and its Progress bar need it: the page draws it, the bar names its step. */
export interface HomepageSection {
  /** What finds it, never its place: the page's code looks for the plans by `plans`. */
  id: string
  /** Its heading, which is also its step's name on the Progress bar. */
  heading: string
  /** Its step's name where the heading is a sentence (Welcome, ticket 0830). */
  step?: string
  /** Where its heading shows: over it as the section's title, inside what it shows, or only to screen readers. */
  title: 'above' | 'inside' | 'hidden'
  /** Whether what it shows stands in the middle of its room. */
  centred?: boolean
  /** What it shows, and the props and listeners that takes, read as the page draws it. */
  shows: Component
  with?: () => Record<string, unknown>
}

/** A section's name on the Progress bar, the phone bar and the line saying what is next (ticket 0830). */
export function stepName(section: Pick<HomepageSection, 'heading' | 'step'>): string {
  return section.step ?? section.heading
}
