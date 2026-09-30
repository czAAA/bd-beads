import type { TourStatus } from '../services/tourStore'

/** Where the Overview lives under the app's base path: a folder with its own index.html, so a static host serves it (ADR 0022). */
export const OVERVIEW_PATH = 'overview/'

/** Set for this tab once the visitor has chosen the editor, so the main address doesn't send them straight back. */
const EDITOR_CHOSEN_KEY = 'bd-beads:editor-chosen'

/**
 * Whether the main address sends the visitor to the Overview instead of the editor (ticket 77): only when this
 * device's Pattern library is empty and the Tour has been neither finished nor turned off, and they haven't just
 * chosen the editor from the Overview.
 */
export function shouldOpenOverview(libraryEmpty: boolean, tour: TourStatus, editorChosen: boolean): boolean {
  return libraryEmpty && !editorChosen && (tour === 'untouched' || tour === 'running')
}

export function overviewUrl(base: string): string {
  return `${base}${OVERVIEW_PATH}`
}

export function markEditorChosen(): void {
  try {
    sessionStorage.setItem(EDITOR_CHOSEN_KEY, '1')
  } catch {
    // Nothing to remember it in: the main address may offer the Overview again, which is harmless.
  }
}

export function isEditorChosen(): boolean {
  try {
    return sessionStorage.getItem(EDITOR_CHOSEN_KEY) === '1'
  } catch {
    return false
  }
}
