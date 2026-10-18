import { onBeforeUnmount, onMounted } from 'vue'

/** The canvas's own root (ProjectSurface): the one place a zoom gesture may start and still zoom. */
const CANVAS_SELECTOR = '[data-testid="project-surface"]'

function startsInCanvas(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(CANVAS_SELECTOR) !== null
}

// Locks Page zoom (ticket 316, ADR 0034) so Canvas zoom is the only zoom. Covers what viewport meta and `touch-action`
// can't: Ctrl/Cmd + wheel and trackpad pinch outside the canvas, iOS Safari `gesture*` events. A gesture keeps
// its start target; under touch the canvas pinches by pointer events, so Safari's zoom must not stack (350).
export function usePageZoomLock() {
  function onWheel(event: WheelEvent) {
    if ((event.ctrlKey || event.metaKey) && !startsInCanvas(event.target)) {
      event.preventDefault()
    }
  }

  /** Fingers on the screen: the canvas pinches by its own pointer handling (usePinchPan), so Safari's gesture must
   * not zoom the page as well. */
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
