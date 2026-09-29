import { onBeforeUnmount, onMounted } from 'vue'
import type { Pattern } from '../domain/pattern'
import { importPatterns } from '../domain/patternFile'
import { patternFromShareLink } from '../domain/qrExport'

/** What opening a shared link needs from the app shell: the library, its add, and its deferred-save flush. */
export interface SharedPatternLinkDeps {
  patterns: () => Pattern[]
  addPattern: (pattern: Pattern) => void
  flushPendingSave: () => void
}

/**
 * Opening the app through a scanned QR export's link, and the page-lifecycle hooks around it (tickets 55, 68, 203; ADR
 * 0015, 0023): on mount the link's Pattern is opened, and the page's pagehide and unmount flush any deferred save.
 * Registers its own lifecycle hooks, so it must be called from a component's setup. Deps are read lazily.
 */
export function useSharedPatternLink(deps: SharedPatternLinkDeps) {
  /**
   * The safety net for a stroke's deferred save (ticket 55): endStroke normally writes it, on the mouseup the app shell
   * hears, but a button released outside the document — dragging off the window edge to paint the last column — fires
   * no mouseup anywhere on the page, leaving that stroke in memory only. Any later edit would carry it (a save writes
   * the whole library), so the one thing that could actually lose it is leaving the page first; pagehide is where that
   * is caught. A no-op whenever storage is already up to date.
   */
  function onPageHide() {
    deps.flushPendingSave()
  }

  /**
   * Opens the Pattern a scanned QR export's link carries (ticket 68, ADR 0015). It lands as its own Pattern — under a
   * fresh id if this device already has that one, like any import — and opens even when another is open, since
   * scanning a code is the request to look at it. The fragment is then dropped, so a refresh or a bookmark doesn't
   * import it a second time.
   */
  function openSharedPatternFromUrl(): void {
    if (!window.location.hash.startsWith('#pattern=')) {
      return
    }
    try {
      const shared = patternFromShareLink(window.location.hash)
      if (shared) {
        const [added] = importPatterns([shared], deps.patterns())
        deps.addPattern(added!)
      }
    } catch {
      // A link that can't be read is left as an ordinary page load: the library opens as it was.
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  onMounted(() => {
    openSharedPatternFromUrl()
    window.addEventListener('pagehide', onPageHide)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', onPageHide)
    deps.flushPendingSave()
  })
}
