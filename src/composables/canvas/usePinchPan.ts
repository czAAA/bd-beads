import { onBeforeUnmount, watch, type Ref } from 'vue'

interface PinchPanDeps {
  zoom: () => number
  /** Sets the zoom, keeping the point of the viewport under `anchor` where it is. */
  setZoom: (value: number, anchor?: { x: number; y: number }) => void
  /** Moves the canvas under the viewport by a distance on screen. */
  panBy: (dx: number, dy: number) => void
  /** Drops the paint stroke the first finger began, with the bead(s) it already painted: that finger was the start
   * of a pinch, not a stroke. */
  cancelStroke: () => void
  /** Turns the Canvas by an angle in degrees, clockwise, about a point of the viewport (ticket 0672). */
  twistBy: (by: number, anchor: { x: number; y: number }) => void
  /** Every finger is up: the twist comes to rest. */
  endTwist: () => void
}

interface Point {
  x: number
  y: number
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** The direction from one finger to the other on screen, in degrees clockwise (y runs down). */
function angle(a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/** A change of angle the short way round: never more than half a turn either way. */
function shortest(degrees: number): number {
  return degrees > 180 ? degrees - 360 : degrees <= -180 ? degrees + 360 : degrees
}

// Two fingers pinch-zoom, pan and twist the Project (tickets 79, 0672); one finger stays a stroke (`touch-action: none`,
// ticket 60). Listens in the capture phase on the scroller: the second finger takes back the first's stroke and the
// surface hears nothing until all are up. Zoom follows the spread with no steps, the turn the fingers'; touch only.
export function usePinchPan(scrollEl: Ref<HTMLElement | null>, deps: PinchPanDeps) {
  const touches = new Map<number, Point>()
  let gesturing = false
  let startSpread = 0
  let startZoom = 1
  let lastMid: Point = { x: 0, y: 0 }
  let lastAngle = 0

  function firstTwo(): [Point, Point] {
    const [a, b] = [...touches.values()]
    return [a as Point, b as Point]
  }

  function onDown(event: PointerEvent) {
    if (event.pointerType !== 'touch') return
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touches.size === 2) {
      if (!gesturing) deps.cancelStroke()
      // A finger put down again mid-gesture starts the spread, the middle and the angle afresh, so nothing jumps.
      const [a, b] = firstTwo()
      gesturing = true
      startSpread = Math.max(distance(a, b), 1)
      startZoom = deps.zoom()
      lastMid = midpoint(a, b)
      lastAngle = angle(a, b)
    }
    if (gesturing) event.stopPropagation()
  }

  function onMove(event: PointerEvent) {
    const known = touches.get(event.pointerId)
    if (!known) return
    known.x = event.clientX
    known.y = event.clientY
    if (!gesturing) return
    event.stopPropagation()
    if (touches.size < 2) return

    const [a, b] = firstTwo()
    const mid = midpoint(a, b)
    const box = scrollEl.value?.getBoundingClientRect()
    // The point between the fingers stays under them as the zoom changes; moving them together moves the canvas with
    // them.
    const anchor = { x: mid.x - (box?.left ?? 0), y: mid.y - (box?.top ?? 0) }
    deps.setZoom(startZoom * (distance(a, b) / startSpread), anchor)
    deps.panBy(mid.x - lastMid.x, mid.y - lastMid.y)
    lastMid = mid
    const turned = angle(a, b)
    deps.twistBy(shortest(turned - lastAngle), anchor)
    lastAngle = turned
  }

  function onEnd(event: PointerEvent) {
    if (!touches.delete(event.pointerId)) return
    if (touches.size === 0 && gesturing) {
      gesturing = false
      deps.endTwist()
    }
  }

  function attach(el: HTMLElement) {
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointermove', onMove, true)
    el.addEventListener('pointerup', onEnd, true)
    el.addEventListener('pointercancel', onEnd, true)
  }

  function detach(el: HTMLElement) {
    el.removeEventListener('pointerdown', onDown, true)
    el.removeEventListener('pointermove', onMove, true)
    el.removeEventListener('pointerup', onEnd, true)
    el.removeEventListener('pointercancel', onEnd, true)
    touches.clear()
    if (gesturing) deps.endTwist()
    gesturing = false
  }

  watch(
    scrollEl,
    (el, previous) => {
      if (previous) detach(previous)
      if (el) attach(el)
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    if (scrollEl.value) detach(scrollEl.value)
  })
}
