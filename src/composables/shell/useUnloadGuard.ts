import { onScopeDispose } from 'vue'

/** Something that would be lost if the page went now: asked at the moment a reload or closing the tab starts. */
export type UnloadReason = () => boolean

/** The browser's own "Leave site?" on a reload or closing the tab (ticket 0861): one listener for the whole page, which
 * asks while any reason registered with `askWhile` says something would be lost, and lets the page go at once otherwise.
 * The converter's setup is one reason; a save that failed can be another without a second listener. */
export function useUnloadGuard() {
  const reasons = new Set<UnloadReason>()

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (![...reasons].some((reason) => reason())) return
    event.preventDefault()
    // Older Safari and Chrome ask only when the event's returnValue is set as well.
    event.returnValue = ''
  }

  window.addEventListener('beforeunload', onBeforeUnload)
  onScopeDispose(() => window.removeEventListener('beforeunload', onBeforeUnload))

  /** Asks before the page goes while `reason` says so, until the returned function is called. */
  function askWhile(reason: UnloadReason): () => void {
    reasons.add(reason)
    return () => reasons.delete(reason)
  }

  return { askWhile }
}
