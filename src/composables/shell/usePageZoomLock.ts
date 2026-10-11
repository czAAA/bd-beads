import { onBeforeUnmount, onMounted } from 'vue'

/** The canvas's own root (ProjectSurface): the one place a zoom gesture may start and still zoom. */
const CANVAS_SELECTOR = '[data-testid="project-surface"]'

function startsInCanvas(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(CANVAS_SELECTOR) !== null
}

/**
 * Locks Page zoom (ticket 316, ADR 0034) so Canvas zoom is the only zoom. The viewport meta and `touch-action:
 * manipulation` stop the double-tap and the Android pinch; this covers what they cannot: Ctrl/⌘ + wheel (and a
 * trackpad pinch, which arrives the same way) outside the canvas, and iOS Safari's `gesture*` events, which ignore
 * `user-scalable=no`. A gesture's events keep the target it started on, so one that drifts onto the canvas stays
 * inert, and one that started inside keeps zooming the canvas, except under touch, where the canvas pinches by pointer events and Safari's own page zoom would stack on top of it (ticket 350). Inside the canvas the surface handles its own wheel.
 */
export function usePageZoomLock() {
  function onWheel(event: WheelEvent) {
    if ((event.ctrlKey || event.metaKey) && !startsInCanvas(event.target)) {
      event.preventDefault()
    }
  }

  /** Fingers on the screen: the canvas pinches by its own pointer handling (usePinchPan), so Safari's gesture must not zoom the page as well. */
  const touches = new Set<number>()

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      touches.add(event.pointerId)
    }
  }

  function onPointerEnd(event: PointerEvent) {
    touches.delete(event.pointerId)
  }

  function onGesture(event: Event) {
    if (touches.size > 0 || !startsInCanvas(event.target)) {
      event.preventDefault()
    }
  }

  onMounted(() => {
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointerup', onPointerEnd, true)
    window.addEventListener('pointercancel', onPointerEnd, true)
    window.addEventListener('gesturestart', onGesture)
    window.addEventListener('gesturechange', onGesture)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('pointerup', onPointerEnd, true)
    window.removeEventListener('pointercancel', onPointerEnd, true)
    window.removeEventListener('gesturestart', onGesture)
    window.removeEventListener('gesturechange', onGesture)
  })
}
