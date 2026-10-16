import { onBeforeUnmount, ref, type Ref } from 'vue'
import { nearestPillEdge, type PillPosition } from '../../domain/toolPill'

/** A press that moves this far (px) before it lifts is a drag; less is still a tap (ToolPill card). */
const PILL_DRAG_THRESHOLD_PX = 8

/**
 * Dragging the Tool pill to another edge (ticket 439, ADR 0059): after 8px of movement the pill lifts and follows the
 * pointer, the edge nearest the pointer is the one it will snap to, and letting go moves it there. The click that ends
 * a drag is swallowed, so a tile under the pointer is not pressed. `layer` is the drawing area the pill floats over.
 */
export function useToolPillDrag(pill: Ref<HTMLElement | undefined>, layer: Ref<HTMLElement | undefined>, deps: { onStart: () => void; onDrop: (position: PillPosition) => void }) {
  const dragging = ref(false)
  /** The edge the pill snaps to if it is let go now. */
  const nearest = ref<PillPosition>('bottom')
  /** The lifted pill's top-left corner in the layer's pixels. */
  const corner = ref({ left: 0, top: 0 })

  let pressed: { id: number; x: number; y: number; grabX: number; grabY: number } | undefined

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !pill.value) return
    const box = pill.value.getBoundingClientRect()
    pressed = { id: event.pointerId, x: event.clientX, y: event.clientY, grabX: event.clientX - box.left, grabY: event.clientY - box.top }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
  }

  function onPointerMove(event: PointerEvent) {
    const area = layer.value?.getBoundingClientRect()
    if (!pressed || event.pointerId !== pressed.id || !area) return
    if (!dragging.value) {
      if (Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < PILL_DRAG_THRESHOLD_PX) return
      dragging.value = true
      pill.value?.setPointerCapture?.(pressed.id)
      deps.onStart()
    }
    corner.value = { left: event.clientX - area.left - pressed.grabX, top: event.clientY - area.top - pressed.grabY }
    nearest.value = nearestPillEdge({ x: event.clientX, y: event.clientY }, area)
  }

  function onPointerEnd(event: PointerEvent) {
    if (!pressed || event.pointerId !== pressed.id) return
    const wasDragging = dragging.value
    stop()
    if (!wasDragging) return
    if (event.type === 'pointerup') deps.onDrop(nearest.value)
    const swallow = (click: Event) => click.stopPropagation()
    window.addEventListener('click', swallow, { capture: true, once: true })
    // A drag that ends with no click (a different target under the pointer) leaves nothing behind.
    setTimeout(() => window.removeEventListener('click', swallow, true), 0)
  }

  function stop() {
    pressed = undefined
    dragging.value = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerEnd)
    window.removeEventListener('pointercancel', onPointerEnd)
  }
  onBeforeUnmount(stop)

  return { dragging, nearest, corner, onPointerDown }
}
