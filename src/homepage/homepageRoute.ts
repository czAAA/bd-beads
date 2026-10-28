/** Where the Homepage lives under the app's base path: a folder with its own index.html, so the Worker's static
 * assets serve it (ADR 0014). */
const HOMEPAGE_PATH = 'homepage/'

/** Set for this tab once the visitor has chosen the editor, so the main address doesn't send them straight back. */
const EDITOR_CHOSEN_KEY = 'openbeads:editor-chosen'

// Whether the main address sends the visitor to the Homepage (ticket 77): only when this device's library is empty,
// and they haven't just chosen the editor from the Homepage.
export function shouldOpenHomepage(libraryEmpty: boolean, editorChosen: boolean): boolean {
  return libraryEmpty && !editorChosen
}

export function homepageUrl(base: string): string {
  return `${base}${HOMEPAGE_PATH}`
}

export function markEditorChosen(): void {
  try {
    sessionStorage.setItem(EDITOR_CHOSEN_KEY, '1')
  } catch {
    // Nothing to remember it in: the main address may offer the Homepage again, which is harmless.
  }
}

export function isEditorChosen(): boolean {
  try {
    return sessionStorage.getItem(EDITOR_CHOSEN_KEY) === '1'
  } catch {
    return false
  }
}
