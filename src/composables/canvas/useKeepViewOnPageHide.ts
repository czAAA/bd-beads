import { onScopeDispose } from 'vue'
import type { KeptProjectView } from '../../domain/keptView'
import type { KeptViewStore } from '../../services/keptView'

/** The view a reload opens at (ticket 1108): kept whenever the page is hidden or left, which a reload, and an iPad that
 * drops a tab in the background, both go through; forgotten when the view follows the fit. Until `known` (a Project
 * open and its view placed), the one kept before stays, so a page left while it loads still reopens there. */
export function useKeepViewOnPageHide(store: KeptViewStore, current: () => KeptProjectView | undefined, known: () => boolean) {
  const keep = () => {
    if (known()) store.write(current())
  }
  const onHidden = () => {
    if (document.visibilityState === 'hidden') keep()
  }
  window.addEventListener('pagehide', keep)
  document.addEventListener('visibilitychange', onHidden)
  onScopeDispose(() => {
    window.removeEventListener('pagehide', keep)
    document.removeEventListener('visibilitychange', onHidden)
  })
}
