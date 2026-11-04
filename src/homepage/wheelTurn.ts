// A wheel or trackpad turning the Homepage's box (tickets 0784, 0793; Homepage card, the scroll story): a section turns
// on its second scroll the same way, however short; the first reaches its end. Counted in scrolls, not distance, so a
// slow notch (a few px on macOS) counts as much as a long swipe.

/** How long a section stays before the next turn, in ms: the turn's own length, `--section-turn`. */
const TURN_REST = 600
/** The quiet that ends a gesture, in ms: a trackpad's momentum keeps one going, a pause between notches ends it. */
export const GESTURE_GAP = 300
/** How far the section leans with its first scroll, in px: the least at once, the most over a notch. */
const LEAN_LEAST = 8
const LEAN_MAX = 16
/** A notch, in px, in most browsers. */
const NOTCH = 100
/** A wheel's line, in px: a notch is three in Firefox. */
const LINE = NOTCH / 3

/** A run of wheel events with no quiet gap between them: one scroll. */
export interface WheelGesture {
  start: number
  last: number
  /** How far it has scrolled, in px, down positive. */
  distance: number
  /** It has turned the box: the rest of it, momentum and all, turns nothing and readies nothing. */
  spent: boolean
  /** It scrolled something itself, a section taller than its room or the page past the plans: it turns nothing, but
   * it readies the next. */
  scrolled: boolean
}

/** One wheel event: its scroll in px, down positive, and when it came. */
export interface Wheel {
  delta: number
  time: number
}

/** A way the box turns: 1 down, -1 up. */
export type Way = 1 | -1

/** A wheel event's vertical scroll in px, whatever unit the browser gave it in. */
export function wheelPixels(event: { deltaY: number; deltaMode: number }, viewport: number): number {
  if (event.deltaMode === 1) return event.deltaY * LINE
  if (event.deltaMode === 2) return event.deltaY * viewport
  return event.deltaY
}

/** Adds a wheel event to its gesture, or starts a new one after a quiet gap. */
export function addWheel(gesture: WheelGesture | undefined, wheel: Wheel): WheelGesture {
  if (!gesture || wheel.time - gesture.last >= GESTURE_GAP) {
    return { start: wheel.time, last: wheel.time, distance: wheel.delta, spent: false, scrolled: false }
  }
  return { ...gesture, last: wheel.time, distance: gesture.distance + wheel.delta }
}

/** The gesture once it has turned the box. */
export function spend(gesture: WheelGesture): WheelGesture {
  return { ...gesture, spent: true }
}

/** The gesture once it has scrolled something itself. */
export function scrolling(gesture: WheelGesture): WheelGesture {
  return { ...gesture, scrolled: true }
}

/** The way a gesture went, if it went anywhere. */
function wayOf(gesture: WheelGesture): Way | undefined {
  return gesture.distance > 0 ? 1 : gesture.distance < 0 ? -1 : undefined
}

/** The way an ended gesture readies the section to turn on the next scroll, if it does: any scroll that did not turn
 * the box, at its end or on the way there. */
export function readies(gesture: WheelGesture): Way | undefined {
  return gesture.spent ? undefined : wayOf(gesture)
}

/** Which way the gesture turns the box and when, if it does: once a scroll before it readied the section that way, and
 * the section turned to at `lastTurn` has stood its while. */
export function turnDue(
  gesture: WheelGesture | undefined,
  ready: Way | undefined,
  lastTurn: number,
): { way: Way; at: number } | undefined {
  if (!gesture || gesture.spent || gesture.scrolled || !ready || wayOf(gesture) !== ready) return undefined
  return { way: ready, at: Math.max(gesture.start, lastTurn + TURN_REST) }
}

/** How far the shown section leans with a scroll that does not turn it, in px, up negative: it goes the page's way. */
export function leanOf(gesture: WheelGesture | undefined): number {
  if (!gesture || gesture.spent || gesture.scrolled) return 0
  const way = wayOf(gesture)
  if (!way) return 0
  const lean = (LEAN_MAX * Math.abs(gesture.distance)) / NOTCH
  return -way * Math.min(LEAN_MAX, Math.max(LEAN_LEAST, lean))
}
