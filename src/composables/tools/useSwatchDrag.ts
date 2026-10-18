import { onBeforeUnmount, ref } from 'vue'

/** How far a mouse or pen moves before a press on a swatch becomes a drag; a touch holds this long instead, so a
 * swipe still scrolls the sheet. */
const DRAG_THRESHOLD_PX = 5
const TOUCH_HOLD_MS = 300
/** A touch that moves this far before the hold ended is a scroll. */
const TOUCH_SCROLL_PX = DRAG_THRESHOLD_PX * 2

// Dragging a Palette swatch to another slot (ticket 398). A press becomes a drag once the pointer moves a few pixels
// (touch: once held a moment); the swatch under the pointer on release is the target. `onMove(from, to)` gets slot
// indexes. The click that ends a drag is swallowed through `consumeDrag()`.
export function useSwatchDrag(onMove: (from: number, to: number) => void, slotAt: (x: number, y: number) => number | undefined) {
  /** The slot being dragged, and the slot it would land in right now; undefined outside a drag. */
  const draggingFrom = ref<number>()
  const hoverSlot = ref<number>()
  let pending: { slot: number; x: number; y: number; touch: boolean; id: number } | undefined
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let swallowClick = false

  const blockScroll = (event: TouchEvent) => {
    if (draggingFrom.value !== undefined) event.preventDefault()
  }

  function stop() {
    clearTimeout(holdTimer)
    pending = undefined
    draggingFrom.value = undefined
    hoverSlot.value = undefined
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', stop)
    window.removeEventListener('touchmove', blockScroll)
  }

  function onPointerMove(event: PointerEvent) {
    if (!pending || event.pointerId !== pending.id) return
    if (draggingFrom.value === undefined) {
      if (pending.touch) {
        // A move before the hold is a scroll, not a drag.
        if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > TOUCH_SCROLL_PX) stop()
        return
      }
      if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < DRAG_THRESHOLD_PX) return
      draggingFrom.value = pending.slot
    }
    hoverSlot.value = slotAt(event.clientX, event.clientY)
  }

  function onPointerUp(event: PointerEvent) {
    const from = draggingFrom.value
    const to = from === undefined ? undefined : slotAt(event.clientX, event.clientY)
    if (from !== undefined && to !== undefined && to !== from) {
      swallowClick = true
      // The click that follows a drag's release comes (or doesn't) right after; don't let the flag outlive it.
      setTimeout(() => (swallowClick = false), 0)
    }
    stop()
    if (from !== undefined && to !== undefined && to !== from) onMove(from, to)
  }

  /** `@pointerdown` on a swatch. */
  function onPointerDown(event: PointerEvent, slot: number) {
    if (event.button !== 0) return
    stop()
    const touch = event.pointerType === 'touch'
    pending = { slot, x: event.clientX, y: event.clientY, touch, id: event.pointerId }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', stop)
    if (touch) {
      window.addEventListener('touchmove', blockScroll, { passive: false })
      holdTimer = setTimeout(() => (draggingFrom.value = slot), TOUCH_HOLD_MS)
    }
  }

  /** True once for the click that ends a drag, so the swatch it was released over isn't also picked. */
  function consumeDrag(): boolean {
    const was = swallowClick
    swallowClick = false
    return was
  }

  onBeforeUnmount(stop)

  return { draggingFrom, hoverSlot, onPointerDown, consumeDrag }
}
