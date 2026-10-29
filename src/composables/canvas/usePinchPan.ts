import { onBeforeUnmount, watch, type Ref } from 'vue'
import type { Scroll } from '../../rendering/surfaceView'
import type { PinchStep } from './useCanvasView'

interface PinchPanDeps {
  zoom: () => number
  /** Moves the view by one step of the gesture. */
  pinch: (step: PinchStep) => void
  /** Drops the paint stroke the first finger began, with the bead(s) it already painted: that finger was the start
   * of a pinch, not a stroke. */
  cancelStroke: () => void
  /** Every finger is up: the twist comes to rest, about where the fingers last were (a point of the viewport). */
  endTwist: (anchor: Scroll) => void
}

/** How far the fingers turn since landing before the turn is a twist and not the wobble of a pinch or pan (ticket
 * 0709): about what the popular touch apps ask. */
const TWIST_ENGAGE_DEGREES = 10

function midpoint(a: Scroll, b: Scroll): Scroll {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function distance(a: Scroll, b: Scroll): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** The direction from one finger to the other on screen, in degrees clockwise (y runs down). */
function angle(a: Scroll, b: Scroll): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/** A change of angle the short way round: never more than half a turn either way. */
function shortest(degrees: number): number {
  return degrees > 180 ? degrees - 360 : degrees <= -180 ? degrees + 360 : degrees
}

// Two fingers pinch-zoom, pan and twist the Project (tickets 79, 0672, 0709); one finger stays a stroke (`touch-action:
// none`, ticket 60). Listens in the capture phase on the scroller: the second finger takes back the first's stroke and
// the surface hears nothing until all are up. Zoom follows the spread with no steps; touch only.
export function usePinchPan(scrollEl: Ref<HTMLElement | null>, deps: PinchPanDeps) {
  const touches = new Map<number, Scroll>()
  let gesturing = false
  let twisting = false
  let startSpread = 0
  let startZoom = 1
  let lastMid: Scroll = { x: 0, y: 0 }
  let lastAngle = 0

  function firstTwo(): [Scroll, Scroll] {
    const [a, b] = [...touches.values()]
    return [a as Scroll, b as Scroll]
  }

  /** A point on screen as a point of the viewport. */
  function anchorOf(point: Scroll): Scroll {
    const box = scrollEl.value?.getBoundingClientRect()
    return { x: point.x - (box?.left ?? 0), y: point.y - (box?.top ?? 0) }
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
    const turned = angle(a, b)
    let turn: number | undefined = shortest(turned - lastAngle)
    if (!twisting) {
      // Until the fingers have clearly turned, the angle is left where they landed; once they have, the twist starts
      // from the angle they are at, so the Canvas does not jump by the threshold.
      twisting = Math.abs(turn) >= TWIST_ENGAGE_DEGREES
      turn = twisting ? 0 : undefined
    }
    if (twisting) lastAngle = turned
    // The point between the fingers stays under them as the zoom changes; moving them together moves the canvas with
    // them.
    deps.pinch({ zoom: startZoom * (distance(a, b) / startSpread), pan: { x: mid.x - lastMid.x, y: mid.y - lastMid.y }, turn, anchor: anchorOf(mid) })
    lastMid = mid
  }

  function onEnd(event: PointerEvent) {
    if (!touches.delete(event.pointerId)) return
    if (touches.size === 0 && gesturing) {
      gesturing = false
      twisting = false
      deps.endTwist(anchorOf(lastMid))
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
    if (gesturing) deps.endTwist(anchorOf(lastMid))
    gesturing = false
    twisting = false
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
