// A wheel or trackpad turning the Homepage's box (tickets 0784, 0801; Homepage card, the scroll story): one scroll turns
// one section, on its first event; the rest of it, momentum and all, turns nothing. Counted in scrolls, not distance,
// so a slow notch (a few px on macOS) turns as surely as a long swipe.

/** How long a section stays before the next turn, in ms: the turn's own length, `--section-turn`. */
export const TURN_REST = 600
/** The quiet that ends a gesture, in ms: a trackpad's momentum keeps one going, a pause between notches ends it. */
export const GESTURE_GAP = 300
/** How long a gesture's speed is smoothed over, in ms: wheel events a busy frame lumps into one read as the same speed. */
const SPEED_SPAN = 50
/** A speed this many times the gesture's slowest since its fastest, in one that turned or scrolled a section, is a new
 * push: momentum only fades, so it never rises so (ticket 1131). */
const NEW_PUSH = 2
/** The least speed of a new push, in px per ms: a slow swipe moves 5px a frame, momentum's last events 1px. */
const NEW_PUSH_LEAST = 0.25
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
  /** How fast it scrolls now, in px per ms, smoothed over `SPEED_SPAN`. */
  speed: number
  /** Its fastest so far and its slowest since then: a clear rise from the slowest is a new push. */
  peak: number
  low: number
  /** A new push came since it turned or scrolled: it starts a new scroll once the section has stood its while. */
  pushed: boolean
  /** It has turned the box: the rest of it turns nothing and scrolls nothing. */
  spent: boolean
  /** It scrolled something itself, a section taller than its room: it turns nothing, even once that reaches its end; a
   * new push riding on its momentum starts a new gesture. */
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

/** Whether the gesture's speed is a new push: a clear rise from its slowest, after it faded from its fastest. A real
 * swipe ramps up, no event twice the one before, so it is weighed against the slowest, not the last (ticket 1131). */
function pushes(gesture: WheelGesture, speed: number): boolean {
  return speed >= NEW_PUSH_LEAST && speed >= NEW_PUSH * gesture.low && gesture.peak >= NEW_PUSH * gesture.low
}

/** What a wheel event adds to its gesture's speed, in px per ms. */
function speedOf(wheel: Wheel): number {
  return Math.abs(wheel.delta) / SPEED_SPAN
}

/** A gesture's fastest and slowest counted from the speed it has now, no new push seen yet. */
function fromNow(speed: number): Pick<WheelGesture, 'speed' | 'peak' | 'low' | 'pushed'> {
  return { speed, peak: speed, low: speed, pushed: false }
}

/** A new gesture begun by a wheel event. */
function begin(wheel: Wheel): WheelGesture {
  return { start: wheel.time, last: wheel.time, distance: wheel.delta, ...fromNow(speedOf(wheel)), spent: false, scrolled: false }
}

/** Adds a wheel event to its gesture, or starts a new one: after a quiet gap, or inside a gesture that turned or
 * scrolled a section, on a scroll the other way or a new push once the section has stood its while. A trackpad's
 * momentum keeps a gesture going a second or more, and the next swipe often starts in it (tickets 1116, 1131). */
export function addWheel(gesture: WheelGesture | undefined, wheel: Wheel): WheelGesture {
  if (!gesture || wheel.time - gesture.last >= GESTURE_GAP) return begin(wheel)
  const speed = gesture.speed * Math.exp((gesture.last - wheel.time) / SPEED_SPAN) + speedOf(wheel)
  const marked = gesture.spent || gesture.scrolled
  const pushed = marked && (gesture.pushed || pushes(gesture, speed))
  const back = marked && wheel.delta !== 0 && Math.sign(wheel.delta) !== Math.sign(gesture.distance)
  if (back || (pushed && wheel.time - gesture.start >= TURN_REST)) return begin(wheel)
  // Still rising to its fastest is the same push: its slowest is counted from there.
  const low = speed > gesture.peak && !pushed ? speed : Math.min(gesture.low, speed)
  return { ...gesture, last: wheel.time, distance: gesture.distance + wheel.delta, speed, peak: Math.max(gesture.peak, speed), low, pushed }
}

/** The gesture once it has turned the box: a new push in it is counted from here. */
export function spend(gesture: WheelGesture): WheelGesture {
  return { ...gesture, ...fromNow(gesture.speed), spent: true }
}

/** The gesture once it has scrolled something itself: a new push in it is counted from here. */
export function scrolling(gesture: WheelGesture): WheelGesture {
  return { ...gesture, ...fromNow(gesture.speed), scrolled: true }
}

/** Which way the gesture turns the box and when, if it does: at once, or once the section turned to at `lastTurn` has
 * stood its while. */
export function turnDue(gesture: WheelGesture | undefined, lastTurn: number): { way: Way; at: number } | undefined {
  if (!gesture || gesture.spent || gesture.scrolled || !gesture.distance) return undefined
  return { way: gesture.distance > 0 ? 1 : -1, at: Math.max(gesture.start, lastTurn + TURN_REST) }
}
