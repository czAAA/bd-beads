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
 * inert, and one that started inside keeps zooming the canvas. Inside the canvas the surface handles its own wheel.
 */
export function usePageZoomLock() {
  function onWheel(event: WheelEvent) {
    if ((event.ctrlKey || event.metaKey) && !startsInCanvas(event.target)) {
      event.preventDefault()
    }
  }

  function onGesture(event: Event) {
    if (!startsInCanvas(event.target)) {
      event.preventDefault()
    }
  }

  onMounted(() => {
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('gesturestart', onGesture)
    window.addEventListener('gesturechange', onGesture)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('gesturestart', onGesture)
    window.removeEventListener('gesturechange', onGesture)
  })
}
