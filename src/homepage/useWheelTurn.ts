import { onScopeDispose, readonly, ref, type Ref } from 'vue'
import { GESTURE_GAP, addWheel, leanOf, spend, turnDue, wheelPixels, type WheelGesture } from './wheelTurn'

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

/** The Homepage turned by wheel and trackpad (ticket 0784; Homepage card, the scroll story): the page's own scroll is
 * held, and a gesture turns the box one section once it has scrolled some way and lasted a moment (`wheelTurn`); short
 * of that the shown section leans with it. Keys and swipes scroll the page as ever. */
export function useWheelTurn({ section, count, scrollsFreely, viewport, turn }: WheelTurnDeps): {
  /** How far the shown section leans, in px, up negative. */
  lean: Readonly<Ref<number>>
  onWheel: (event: WheelEvent) => void
} {
  const lean = ref(0)
  let gesture: WheelGesture | undefined
  let lastTurn = -Infinity
  /** The gesture has turned the box: the rest of it is held, never scrolling the page itself, so a flick that reaches
   * the plans does not grow the free list too. */
  let holding = false
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
    const next = turnDue(gesture, lastTurn)
    const index = next && towards(next.way)
    if (next && index !== undefined && next.at > now) due = setTimeout(settle, next.at - now)
    else if (next && index !== undefined) {
      gesture = spend(gesture!)
      lastTurn = now
      holding = true
      turn(index)
    }
    lean.value = gesture && towards(gesture.distance) !== undefined ? leanOf(gesture) : 0
  }

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
    const wheel = { delta: wheelPixels(event, viewport()), time: Date.now() }
    clearTimeout(quiet)
    quiet = setTimeout(() => {
      gesture = undefined
      holding = false
      settle()
    }, GESTURE_GAP)
    // A gesture that scrolled anything itself turns nothing, even once it reaches the end of what it scrolled.
    if (!holding && (scrollsInside(event, event.currentTarget) || scrollsFreely(event))) {
      gesture = spend(addWheel(gesture, wheel))
      settle()
      return
    }
    event.preventDefault()
    gesture = addWheel(gesture, wheel)
    settle()
  }

  onScopeDispose(() => {
    clearTimeout(quiet)
    clearTimeout(due)
  })
  return { lean: readonly(lean), onWheel }
}
