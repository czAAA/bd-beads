// Leaving the Homepage, its canvas box grows into the editor's (ticket 0776, ADR 0088). The Homepage remembers where
// its box stands; the editor's index.html draws an empty box there before its code runs, so the browser can cross-fade
// into it; once the app mounts, the box grows into the editor's own.

/** Where the Homepage's canvas box stood as it left for the editor: index.html's arrival script reads it once.
 * @internal Exported for the test that runs that script, which holds the two keys in step. */
export const BOX_HANDOFF_KEY = 'openbeads:homepage-box'

/** Opts this page's navigation into a View Transition; only this one, so no other navigation animates. */
const OPT_IN = '@view-transition { navigation: auto; }'

/** The Homepage, about to leave for the editor: remembers its canvas box and lets the browser carry it across. Does
 * nothing where the browser has no View Transitions or the beader asks for reduced motion. */
export function leaveWithBox(box: Element | null | undefined): void {
  if (!box || !('startViewTransition' in document) || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const { x, y, width, height } = box.getBoundingClientRect()
  const rect = { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
  try {
    sessionStorage.setItem(BOX_HANDOFF_KEY, JSON.stringify(rect))
  } catch {
    return // Nowhere to hand the box over: a plain navigation.
  }
  const style = document.createElement('style')
  style.dataset.handoff = ''
  style.textContent = OPT_IN
  document.head.append(style)
  document.documentElement.dataset.handoff = 'leaving'
  // Back brings this page back from the browser's cache as it was: it isn't leaving any more.
  const undo = (event: PageTransitionEvent) => {
    if (!event.persisted) return
    window.removeEventListener('pageshow', undo)
    style.remove()
    delete document.documentElement.dataset.handoff
    try {
      sessionStorage.removeItem(BOX_HANDOFF_KEY)
    } catch {
      // Not readable either, so the editor won't find it.
    }
  }
  window.addEventListener('pageshow', undo)
}

/** The editor, just mounted after arriving from the Homepage: once the browser's cross-fade into the empty box has
 * ended, grows that box into the editor's canvas box, the editor's other parts fading in around it. */
export async function growIntoEditor(): Promise<void> {
  const root = document.documentElement
  if (root.dataset.handoff !== 'arriving') return
  await window.openbeadsHandoff?.finished.catch(() => undefined)
  const grow = () => {
    document.getElementById('handoff')?.remove()
    root.dataset.handoff = 'growing'
  }
  // The arrival script only hands over where the browser has View Transitions.
  await document.startViewTransition(grow).finished.catch(() => undefined)
  delete root.dataset.handoff
  document.head.querySelector('style[data-handoff]')?.remove()
}
