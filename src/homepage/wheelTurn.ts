// A wheel or trackpad gesture turning the Homepage's box (ticket 0784; Homepage card, the scroll story): not on its
// first notch, only once it has scrolled some way and lasted a moment, one section per gesture.

/** How far a gesture scrolls before it turns the box, in px: more than one wheel notch (100px in most browsers). */
const TURN_DISTANCE = 150
/** How long a gesture lasts before it turns the box, in ms. */
const TURN_TIME = 120
/** How long a section stays before the next turn, in ms: the turn's own length, `--section-turn`. */
const TURN_REST = 600
/** The quiet that ends a gesture, in ms: a trackpad's momentum keeps one going, a pause between notches ends it. */
export const GESTURE_GAP = 300
/** How far the section leans with a gesture short of a turn, in px, at most. */
const LEAN_MAX = 16
/** A wheel's line, in px: a notch is three in Firefox, 100px in the others. */
const LINE = 100 / 3

/** A run of wheel events with no quiet gap between them. */
export interface WheelGesture {
  start: number
  last: number
  /** How far it has scrolled, in px, down positive. */
  distance: number
  /** It has turned the box: the rest of it, momentum and all, turns nothing. */
  spent: boolean
}

/** One wheel event: its scroll in px, down positive, and when it came. */
export interface Wheel {
  delta: number
  time: number
}

/** A wheel event's vertical scroll in px, whatever unit the browser gave it in. */
export function wheelPixels(event: { deltaY: number; deltaMode: number }, viewport: number): number {
  if (event.deltaMode === 1) return event.deltaY * LINE
  if (event.deltaMode === 2) return event.deltaY * viewport
  return event.deltaY
}

/** Adds a wheel event to its gesture, or starts a new one after a quiet gap. */
export function addWheel(gesture: WheelGesture | undefined, wheel: Wheel): WheelGesture {
  if (!gesture || wheel.time - gesture.last >= GESTURE_GAP) return { start: wheel.time, last: wheel.time, distance: wheel.delta, spent: false }
  return { ...gesture, last: wheel.time, distance: gesture.distance + wheel.delta }
}

/** The gesture once it has turned the box. */
export function spend(gesture: WheelGesture): WheelGesture {
  return { ...gesture, spent: true }
}

/** Which way the gesture turns the box (1 down, -1 up) and when, if it does: once it has scrolled far enough, lasted
 * long enough, and the section turned to `lastTurn` has stood its while. */
export function turnDue(gesture: WheelGesture | undefined, lastTurn: number): { way: 1 | -1; at: number } | undefined {
  if (!gesture || gesture.spent || Math.abs(gesture.distance) < TURN_DISTANCE) return undefined
  return { way: gesture.distance > 0 ? 1 : -1, at: Math.max(gesture.start + TURN_TIME, lastTurn + TURN_REST) }
}

/** How far the shown section leans with a gesture short of a turn, in px, up negative: it goes the page's way. */
export function leanOf(gesture: WheelGesture | undefined): number {
  if (!gesture || gesture.spent) return 0
  const lean = (Math.max(-TURN_DISTANCE, Math.min(TURN_DISTANCE, gesture.distance)) / TURN_DISTANCE) * LEAN_MAX
  return lean === 0 ? 0 : -lean
}
