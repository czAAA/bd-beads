import { parseKeptView, type KeptProjectView } from '../domain/keptView'

// The view a reload opens at (ticket 1108), kept in sessionStorage: it is the tab's, so a reload finds it and a new tab
// opens at the fit.

const KEPT_VIEW_KEY = 'openbeads:view'

/** Where the kept view is; a test fakes it. */
export interface KeptViewStore {
  read: () => KeptProjectView | undefined
  /** Keeps a view, or forgets the kept one when there is none to keep. */
  write: (kept: KeptProjectView | undefined) => void
}

/** The view in this tab's sessionStorage. Blocked storage reads as none and keeps nothing: the Project opens at its fit. */
export const browserKeptView: KeptViewStore = {
  read() {
    try {
      return parseKeptView(sessionStorage.getItem(KEPT_VIEW_KEY))
    } catch {
      return undefined
    }
  },
  write(kept) {
    try {
      if (kept) sessionStorage.setItem(KEPT_VIEW_KEY, JSON.stringify(kept))
      else sessionStorage.removeItem(KEPT_VIEW_KEY)
    } catch {
      // No storage: the reload opens at the fit.
    }
  },
}
