/** Where the editor lives under the app's base path: a folder with its own index.html, so the Worker's static assets
 * serve it (ADR 0014). The Homepage is the base path itself, the main address (ticket 1052, ADR 0097). */
const EDITOR_PATH = 'app/'

/** Set once a tab has shown the Homepage or the editor, so the main address is the Homepage from then on. */
const ARRIVED_KEY = 'openbeads:arrived'

// Whether the main address sends the visitor on to the editor (ticket 1052): only as a tab's first page, and only
// when this device's library holds Projects. An unknown count is not a maker with work: the Homepage says why.
export function shouldOpenEditor(projectCount: number | 'unopened', arrived: boolean): boolean {
  return projectCount !== 'unopened' && projectCount > 0 && !arrived
}

/** The Homepage's address: the main one. */
export function homepageUrl(base: string): string {
  return base
}

/** The editor's address, which its own addresses (`domain/openingAddress.ts`) are built on. */
export function editorUrl(base: string): string {
  return `${base}${EDITOR_PATH}`
}

/** The Homepage's address that opens it at What's new, unfolded and in view: "Update ready"'s link (ticket 1048). */
export const WHATS_NEW_HASH = '#whats-new'

export function whatsNewUrl(base: string): string {
  return `${homepageUrl(base)}${WHATS_NEW_HASH}`
}

/** Notes that this tab has shown one of the app's pages. */
export function markArrived(): void {
  try {
    sessionStorage.setItem(ARRIVED_KEY, '1')
  } catch {
    // Nothing to remember it in: a maker with Projects is sent to the editor from the main address again.
  }
}

export function hasArrived(): boolean {
  try {
    return sessionStorage.getItem(ARRIVED_KEY) === '1'
  } catch {
    return false
  }
}
