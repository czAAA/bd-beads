// Leaving the Homepage, its canvas box grows into the editor's (ticket 0776, ADR 0088). Its content leaves first; the
// box, its Canvas strip and its canvas marks are handed over for the editor's index.html to draw before its code runs,
// so nothing on screen is ever empty (ticket 0783); once the app mounts, the box grows into the editor's own.

/** What the Homepage left for the editor's arrival script, which reads it once.
 * @internal Exported for the test that runs that script, which holds the two keys in step. */
export const BOX_HANDOFF_KEY = 'openbeads:homepage-box'

/** The Homepage's canvas box as the editor's first paint redraws it: its place, its Canvas strip's own markup (the
 * strip's styles are in the stylesheet the editor loads before it paints), and the marks its content stood on.
 * @internal Exported for the test of the arrival script, which hands one over. */
export interface BoxHandoff {
  x: number
  y: number
  width: number
  height: number
  strip: string
  /** The drawing area's top and height inside the box: the marks stop where the Progress bar begins. */
  bodyY: number
  bodyHeight: number
  marks: string
  tile: string
  bg: string
}

/** Opts this page's navigation into a View Transition; only this one, so no other navigation animates. */
const OPT_IN = '@view-transition { navigation: auto; }'

/** How long after the content's fade (`--duration-base`) the navigation follows anyway, should no transitionend come. */
const LEAVE_GRACE_MS = 100
/** The fade's length where the token can't be read (a test page). */
const LEAVE_FALLBACK_MS = 200

/** The box's place, its strip and its marks; nothing where the box lacks either part, so the navigation stays plain. */
function handoffOf(box: Element): BoxHandoff | undefined {
  const strip = box.querySelector('.canvas-strip')
  const body = box.querySelector('.homepage__body')
  if (!strip || !body) return undefined
  const rect = box.getBoundingClientRect()
  const bodyRect = body.getBoundingClientRect()
  const look = getComputedStyle(body)
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    strip: strip.outerHTML,
    bodyY: Math.round(bodyRect.y - rect.y),
    bodyHeight: Math.round(bodyRect.height),
    marks: look.backgroundImage || 'none',
    tile: look.backgroundSize || 'auto',
    bg: look.backgroundColor || 'transparent',
  }
}

/** Resolves once the content's own fade has ended (a button's transition ends sooner and bubbles up too), or after the
 * fade's length plus a grace, should the browser fire no transitionend. */
function contentLeft(page: Element | null): Promise<void> {
  return new Promise((left) => {
    const fadeMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-base')) || LEAVE_FALLBACK_MS
    const done = () => {
      clearTimeout(limit)
      page?.removeEventListener('transitionend', onEnd)
      left()
    }
    const onEnd = (event: Event) => {
      if (event.target === page && (event as TransitionEvent).propertyName === 'opacity') done()
    }
    const limit = setTimeout(done, fadeMs + LEAVE_GRACE_MS)
    page?.addEventListener('transitionend', onEnd)
  })
}

/** The leave under way (while the root says so), so a second press during the fade joins it instead of handing over
 * twice. */
let leaving: Promise<void> | undefined

/** The Homepage, about to leave for the editor: hands its canvas box over, lets its content leave (the strip and the
 * marks stay) and resolves once it has, so the navigation can follow. Resolves at once, with nothing handed over, where
 * the browser has no View Transitions or the beader asks for reduced motion: a plain navigation. */
export function leaveWithBox(box: Element | null | undefined): Promise<void> {
  if (leaving && document.documentElement.dataset.handoff === 'leaving') return leaving
  if (!box || !('startViewTransition' in document) || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve()
  const handoff = handoffOf(box)
  if (!handoff) return Promise.resolve()
  try {
    sessionStorage.setItem(BOX_HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    return Promise.resolve() // Nowhere to hand the box over: a plain navigation.
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
  leaving = contentLeft(box.querySelector('.homepage__page'))
  return leaving
}

/** The editor, just mounted after arriving from the Homepage: once the browser's step across the page load has ended,
 * grows the handed-over box into the editor's canvas box, the editor's other parts fading in around it. */
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
