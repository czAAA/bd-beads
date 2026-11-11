import { onScopeDispose, watch, type Ref } from 'vue'
import type { AppPageId } from './useAppPage'

/** What the hook needs: the App page showing, and that page's Close, which may ask first. */
export interface BackClosesPageDeps {
  page: Ref<AppPageId>
  close: () => unknown
}

/** The browser's Back on an App page other than the editor is that page's Close (ticket 0861): opening the page puts
 * one entry on the tab's history, so Back stays in the app and closes the page, which may ask the person first; staying
 * keeps the entry. A page that goes any other way (Close, Create, a Menu action) takes its entry off again. */
export function useBackClosesPage(deps: BackClosesPageDeps) {
  /** Whether the page's entry is on the history now. */
  let pushed = false
  /** Backs this hook made itself to take the entry off, whose popstate is not the person's. */
  let ownBacks = 0

  function push() {
    history.pushState(history.state, '')
    pushed = true
  }

  watch(
    deps.page,
    (page) => {
      // A page opened again before its last entry came off waits for that Back, or the Back would take the new one.
      if (page !== 'editor' && !pushed && ownBacks === 0) push()
      else if (page === 'editor' && pushed) {
        pushed = false
        ownBacks += 1
        history.back()
      }
    },
    { flush: 'sync' },
  )

  function onPopState() {
    if (ownBacks > 0) {
      ownBacks -= 1
      if (ownBacks === 0 && deps.page.value !== 'editor') push()
      return
    }
    if (!pushed) return
    // The browser took the page's entry off: put it back at once, so a second Back while the page asks is Close again,
    // and Close; a page that goes takes it off as any other leave does.
    push()
    deps.close()
  }

  window.addEventListener('popstate', onPopState)
  onScopeDispose(() => window.removeEventListener('popstate', onPopState))
}
