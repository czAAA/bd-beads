import { onScopeDispose, watch, type Ref } from 'vue'
import { keyMove, keyScroll } from './sectionKeys'
import { GESTURE_GAP, TURN_REST, addWheel, scrolling, spend, turnDue, wheelPixels } from './wheelTurn'
import type { Way, WheelGesture } from './wheelTurn'

/** What turning the Homepage by wheel, swipe and keys needs of the page. */
export interface SectionInputDeps {
  /** The section shown, and how many there are. */
  section: Readonly<Ref<number>>
  count: () => number
  /** The page the sections are drawn in: what scrolls inside it is looked for up to it. */
  page: () => HTMLElement | undefined
  /** The section shown, which the keys scroll when it is taller than its room. */
  shown: () => HTMLElement | undefined
  /** Something in front of the sections has the input, as the Menu or a dialog. */
  held: () => boolean
  reducedMotion: Readonly<Ref<boolean>>
  /** Turns the box to a section. */
  turn: (index: number) => void
}

/** How far a swipe goes before it turns, in px. */
const SWIPE_LEAST = 48
/** What's inside's demo editor, whose keys and touches are its own. */
const DEMO_EDITOR = '.inside-editor'
/** Where the keys are a control's own: a text field, a list or slider the arrows move in, the demo editor. */
const OWN_KEYS = `input, textarea, select, [role="slider"], [role="listbox"], [role="menu"], [role="radiogroup"], [role="tablist"], [role="spinbutton"], ${DEMO_EDITOR}`
/** Where Space presses rather than scrolls. */
const PRESSES = 'button, a[href], summary, [role="button"]'
/** How much of its room More below scrolls a section on (ticket 0826; Homepage card). */
const MORE_SHARE = 0.8

/** Whether an element scrolls itself and has more to go that way: a section taller than its room, More below's fade. */
export function canScroll(el: Element, way: Way): boolean {
  const { overflowY } = getComputedStyle(el)
  if (overflowY !== 'auto' && overflowY !== 'scroll') return false
  return way > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0
}

/** Whether something between `target` and the page scrolls that way itself: a section taller than its room, a list. */
function scrollsInside(target: EventTarget | null, page: Element | undefined, way: Way): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== page; el = el.parentElement) {
    if (canScroll(el, way)) return true
  }
  return false
}

/** The Homepage turned by wheel, trackpad, swipe and keys (tickets 0784, 0801; Homepage card, the scroll story): the page
 * never scrolls itself; a section taller than its room scrolls inside itself, and at its end the next scroll turns the
 * box one section. A section stays `TURN_REST` before a scroll turns it again, however it was reached. */
export function useSectionInput({ section, count, page, shown, held, reducedMotion, turn }: SectionInputDeps) {
  let lastTurn = -Infinity
  let gesture: WheelGesture | undefined
  let quiet: ReturnType<typeof setTimeout> | undefined
  let due: ReturnType<typeof setTimeout> | undefined
  let touch: { x: number; y: number; scrolls: Record<Way, boolean> } | undefined

  /** The section a way leads to, if there is one. */
  function towards(way: Way): number | undefined {
    const index = section.value + way
    return index >= 0 && index < count() ? index : undefined
  }

  /** A swipe or a key turning one way, once the section has stood its while. */
  function turnWay(way: Way) {
    const index = towards(way)
    if (index !== undefined && Date.now() - lastTurn >= TURN_REST) turn(index)
  }

  /** Turns the box if the wheel gesture is due to, now or once the last turn has stood its while. */
  function settle() {
    clearTimeout(due)
    due = undefined
    const next = turnDue(gesture, lastTurn)
    const index = next && towards(next.way)
    if (!next || index === undefined) return
    const wait = next.at - Date.now()
    if (wait > 0) due = setTimeout(settle, wait)
    else {
      gesture = spend(gesture!)
      turn(index)
    }
  }

  /** A wheel scroll has ended: unless it is waiting out the last turn to turn, the next one starts afresh. */
  function ended() {
    if (due === undefined) gesture = undefined
  }

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || held()) return
    const delta = wheelPixels(event, page()?.clientHeight ?? window.innerHeight)
    clearTimeout(quiet)
    quiet = setTimeout(ended, GESTURE_GAP)
    gesture = addWheel(gesture, { delta, time: Date.now() })
    // The rest of a gesture that turned, momentum and all, scrolls nothing in the section it turned to.
    if (!gesture.spent && delta && scrollsInside(event.target, page(), delta > 0 ? 1 : -1)) {
      gesture = scrolling(gesture)
      return
    }
    event.preventDefault()
    settle()
  }

  function onTouchStart(event: TouchEvent) {
    const target = event.target instanceof Element ? event.target : null
    const finger = event.touches[0]
    if (event.touches.length !== 1 || !finger || held() || target?.closest(DEMO_EDITOR)) {
      touch = undefined
      return
    }
    // What could scroll at the start: a swipe that scrolled a section turns nothing, even once it reaches its end.
    touch = { x: finger.clientX, y: finger.clientY, scrolls: { [1]: scrollsInside(target, page(), 1), [-1]: scrollsInside(target, page(), -1) } }
  }

  /** A finger lifted: whether it swiped up or down, turning the box unless it scrolled a section. */
  function onTouchEnd(event: TouchEvent): boolean {
    const start = touch
    const finger = event.changedTouches[0]
    touch = undefined
    if (!start || !finger || event.touches.length) return false
    const up = start.y - finger.clientY
    if (Math.abs(up) < SWIPE_LEAST || Math.abs(up) <= Math.abs(start.x - finger.clientX)) return false
    const way: Way = up > 0 ? 1 : -1
    if (!start.scrolls[way]) turnWay(way)
    return true
  }

  function onTouchCancel() {
    touch = undefined
  }

  /** The keys a page scrolls by, from wherever the focus is, unless a control in focus takes them itself. */
  function onKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || held()) return
    const move = keyMove(event)
    const target = event.target instanceof Element ? event.target : null
    if (!move || target?.closest(OWN_KEYS) || (event.key === ' ' && target?.closest(PRESSES))) return
    event.preventDefault()
    if ('to' in move) {
      const index = move.to === 'first' ? 0 : count() - 1
      if (index !== section.value) turn(index)
      return
    }
    if (!scrollOn(move.way, (room) => keyScroll(move.by, room))) turnWay(move.way)
  }

  /** Scrolls the section shown on by `by` its room's height in px, if it has more that way; whether it did. */
  function scrollOn(way: Way, by: (room: number) => number): boolean {
    const room = shown()
    if (!room || !canScroll(room, way)) return false
    room.scrollBy({ top: way * by(room.clientHeight), behavior: reducedMotion.value ? 'auto' : 'smooth' })
    return true
  }

  /** More below (ticket 0826): the section shown scrolled on most of its room while it has more, else the next one
   * turned to at once, as Next turns to it. */
  function more() {
    const index = towards(1)
    if (!scrollOn(1, (room) => room * MORE_SHARE) && index !== undefined) turn(index)
  }

  // A turn by any means stands its while, and a wheel gesture going on through it turns nothing more.
  watch(
    section,
    () => {
      lastTurn = Date.now()
      if (gesture) gesture = spend(gesture)
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    clearTimeout(quiet)
    clearTimeout(due)
  })
  return { onWheel, onTouchStart, onTouchEnd, onTouchCancel, onKeydown, more }
}
