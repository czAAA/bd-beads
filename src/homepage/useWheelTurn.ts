import { onScopeDispose, readonly, ref, watch, type Ref } from 'vue'
import { GESTURE_GAP, addWheel, leanOf, readies, scrolling, spend, turnDue, wheelPixels } from './wheelTurn'
import type { Way, WheelGesture } from './wheelTurn'

/** What turning the Homepage by wheel needs of the page. */
export interface WheelTurnDeps {
  /** The section shown, and how many there are. */
  section: Readonly<Ref<number>>
  count: () => number
  /** Whether this wheel event is the page's own to scroll, as past the plans where the free list grows (ticket 0742). */
  scrollsFreely: (event: WheelEvent) => boolean
  /** The screen's height, a wheel's page. */
  viewport: () => number
  /** Turns the box to a section and scrolls the page there. */
  turn: (index: number) => void
}

/** Whether something between the wheel and the page scrolls that way itself: a section taller than its room, a list. */
function scrollsInside(event: WheelEvent, page: EventTarget | null): boolean {
  for (let el = event.target as Element | null; el && el !== page; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue
    if (event.deltaY > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true
  }
  return false
}

/** The Homepage turned by wheel and trackpad (tickets 0784, 0793; Homepage card, the scroll story): the page's own
 * scroll is held, and a section turns on its second scroll (`wheelTurn`), the first scrolling it to its end or leaning
 * it. Keys and swipes scroll the page as ever. */
export function useWheelTurn({ section, count, scrollsFreely, viewport, turn }: WheelTurnDeps): {
  /** How far the shown section leans, in px, up negative. */
  lean: Readonly<Ref<number>>
  onWheel: (event: WheelEvent) => void
} {
  const lean = ref(0)
  let gesture: WheelGesture | undefined
  /** The way an ended scroll on the section shown readied it to turn on the next. */
  let ready: Way | undefined
  let lastTurn = -Infinity
  /** When the gesture that turned the box began: the rest of it is held, never scrolling the page itself, so a flick
   * that reaches the plans does not grow the free list too. */
  let turnedStart: number | undefined
  let quiet: ReturnType<typeof setTimeout> | undefined
  let due: ReturnType<typeof setTimeout> | undefined

  /** The section a way leads to, if there is one. */
  function towards(way: number): number | undefined {
    const index = section.value + Math.sign(way)
    return index >= 0 && index < count() ? index : undefined
  }

  function settle() {
    clearTimeout(due)
    const now = Date.now()
    const next = turnDue(gesture, ready, lastTurn)
    const index = next && towards(next.way)
    if (next && index !== undefined && next.at > now) due = setTimeout(settle, next.at - now)
    else if (next && index !== undefined) {
      gesture = spend(gesture!)
      lastTurn = now
      turnedStart = gesture.start
      turn(index)
    }
    lean.value = gesture && towards(gesture.distance) !== undefined ? leanOf(gesture) : 0
  }

  /** A scroll has ended: unless it is waiting out the last turn to turn, it readies the next, and the section settles. */
  function ended() {
    const next = turnDue(gesture, ready, lastTurn)
    if (gesture && !(next && towards(next.way) !== undefined)) {
      ready = readies(gesture)
      gesture = undefined
    }
    settle()
  }

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
    const wheel = { delta: wheelPixels(event, viewport()), time: Date.now() }
    clearTimeout(quiet)
    quiet = setTimeout(ended, GESTURE_GAP)
    // A gesture that scrolled anything itself turns nothing, even once it reaches the end of what it scrolled.
    gesture = addWheel(gesture, wheel)
    const holding = gesture.start === turnedStart
    if (!holding && (scrollsInside(event, event.currentTarget) || scrollsFreely(event))) gesture = scrolling(gesture)
    else event.preventDefault()
    settle()
  }

  // A turn by Next, a step, a key or a swipe stands its while too, and its section counts its scrolls afresh: a gesture
  // going on through the turn readies nothing.
  watch(section, () => {
    lastTurn = Date.now()
    ready = undefined
    if (gesture) gesture = spend(gesture)
  })
  onScopeDispose(() => {
    clearTimeout(quiet)
    clearTimeout(due)
  })
  return { lean: readonly(lean), onWheel }
}
