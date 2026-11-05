// A wheel or trackpad turning the Homepage's box (tickets 0784, 0801; Homepage card, the scroll story): one scroll turns
// one section, on its first event; the rest of it, momentum and all, turns nothing. Counted in scrolls, not distance,
// so a slow notch (a few px on macOS) turns as surely as a long swipe.

/** How long a section stays before the next turn, in ms: the turn's own length, `--section-turn`. */
export const TURN_REST = 600
/** The quiet that ends a gesture, in ms: a trackpad's momentum keeps one going, a pause between notches ends it. */
export const GESTURE_GAP = 300
/** A push this many times as strong as the event before it, in a gesture that turned, is a new scroll riding on the
 * old one's momentum (which only ever fades). */
const NEW_PUSH = 2
/** The least push, in px, that can start a new scroll inside a turned one's momentum. */
const NEW_PUSH_LEAST = 20
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
  /** Its last event's scroll, in px: momentum only fades, so a much stronger one is a new push. */
  lastDelta: number
  /** It has turned the box: the rest of it turns nothing and scrolls nothing. */
  spent: boolean
  /** It scrolled something itself, a section taller than its room: it turns nothing, even once that reaches its end. */
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

/** Whether a wheel event starts a new scroll inside a gesture that turned: the other way, or a fresh push once the turn
 * has stood its while. */
function pushesAgain(gesture: WheelGesture, wheel: Wheel): boolean {
  if (!gesture.spent || !wheel.delta) return false
  if (Math.sign(wheel.delta) !== Math.sign(gesture.distance)) return true
  const strength = Math.abs(wheel.delta)
  return wheel.time - gesture.start >= TURN_REST && strength >= NEW_PUSH_LEAST && strength > NEW_PUSH * Math.abs(gesture.lastDelta)
}

/** Adds a wheel event to its gesture, or starts a new one after a quiet gap or a new push. */
export function addWheel(gesture: WheelGesture | undefined, wheel: Wheel): WheelGesture {
  if (!gesture || wheel.time - gesture.last >= GESTURE_GAP || pushesAgain(gesture, wheel)) {
    return { start: wheel.time, last: wheel.time, distance: wheel.delta, lastDelta: wheel.delta, spent: false, scrolled: false }
  }
  return { ...gesture, last: wheel.time, distance: gesture.distance + wheel.delta, lastDelta: wheel.delta }
}

/** The gesture once it has turned the box. */
export function spend(gesture: WheelGesture): WheelGesture {
  return { ...gesture, spent: true }
}

/** The gesture once it has scrolled something itself. */
export function scrolling(gesture: WheelGesture): WheelGesture {
  return { ...gesture, scrolled: true }
}

/** Which way the gesture turns the box and when, if it does: at once, or once the section turned to at `lastTurn` has
 * stood its while. */
export function turnDue(gesture: WheelGesture | undefined, lastTurn: number): { way: Way; at: number } | undefined {
  if (!gesture || gesture.spent || gesture.scrolled || !gesture.distance) return undefined
  return { way: gesture.distance > 0 ? 1 : -1, at: Math.max(gesture.start, lastTurn + TURN_REST) }
}
