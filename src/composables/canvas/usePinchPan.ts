import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

interface PinchPanDeps {
  zoom: () => number
  setZoom: (value: number) => void
  /** Ends the paint stroke the first finger began: it is the one bead it already painted, kept as its own undo step. */
  endStroke: () => void
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

/**
 * Two fingers on the Pattern pinch it to zoom and pan it (ticket 79; responsive.md's phone tier). One finger stays
 * a paint stroke: the drawing surface keeps `touch-action: none` (ticket 60), so the browser never zooms or scrolls
 * for us and this is the whole gesture recognizer.
 *
 * It listens in the capture phase on the canvas panel's scroller, above the drawing surface. The second finger
 * landing ends the stroke the first began, and from then until every finger is up the surface hears nothing, so
 * neither finger paints. Zoom follows the fingers' spread directly, no steps and no easing (interaction-and-motion.md),
 * and the point between them stays under them as the zoom changes; moving them together scrolls the Pattern.
 * Only touch takes part: a mouse or pen has no second contact, and the zoom pill and keys cover them.
 */
export function usePinchPan(scrollEl: Ref<HTMLElement | null>, deps: PinchPanDeps) {
  const touches = new Map<number, Point>()
  let gesturing = false
  let startSpread = 0
  let startZoom = 1
  let lastMid: Point = { x: 0, y: 0 }

  function firstTwo(): [Point, Point] {
    const [a, b] = [...touches.values()]
    return [a as Point, b as Point]
  }

  function onDown(event: PointerEvent) {
    if (event.pointerType !== 'touch') return
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (!gesturing && touches.size === 2) {
      deps.endStroke()
      const [a, b] = firstTwo()
      gesturing = true
      startSpread = Math.max(distance(a, b), 1)
      startZoom = deps.zoom()
      lastMid = midpoint(a, b)
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
    const before = deps.zoom()
    deps.setZoom(startZoom * (distance(a, b) / startSpread))
    const ratio = deps.zoom() / before
    const pan = { x: lastMid.x - mid.x, y: lastMid.y - mid.y }
    lastMid = mid

    const el = scrollEl.value
    if (!el) return
    const box = el.getBoundingClientRect()
    // The scroll offsets are worked out once the new zoom has laid out, so they clamp against the Pattern's new size.
    void nextTick(() => {
      const anchorX = mid.x - box.left
      const anchorY = mid.y - box.top
      el.scrollLeft = (el.scrollLeft + anchorX) * ratio - anchorX + pan.x
      el.scrollTop = (el.scrollTop + anchorY) * ratio - anchorY + pan.y
    })
  }

  function onEnd(event: PointerEvent) {
    touches.delete(event.pointerId)
    if (touches.size === 0) gesturing = false
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
