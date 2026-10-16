import { onBeforeUnmount, onMounted, ref } from 'vue'
import { isTypingInFormField } from '../shell/useKeyboardShortcuts'

/** The Space key, by its physical code, so it means the same whatever the keyboard layout. */
export function isSpaceKey(event: KeyboardEvent): boolean {
  return event.code === 'Space'
}

/**
 * Whether Space has a native meaning at `target` that panning must not steal -- a focused button (every sheet
 * control) activates on Space in every browser, so hijacking the key there would silently break keyboard-only use
 * of the sheets, not just cursor-driven panning.
 */
function activatesOnSpace(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button')
}

/** The nearest button at or above `target`, so a press on an icon inside a button counts as a press on the button. */
function closestButton(target: EventTarget | null): EventTarget | null {
  return target instanceof Element ? target.closest('button, [role="button"]') : null
}

/**
 * Holding Space and dragging moves the canvas (tickets 95, 233): a pure pan, regardless of which tool
 * is active — never a paint/fill/erase/select, so callers guard their own cell handlers with `spaceHeld` rather
 * than this composable trying to intercept those events itself. Both directions move the Canvas (`panBy`); the page
 * itself never scrolls (ticket 141).
 * Bound to the window, the same way useKeyboardShortcuts is: the canvas takes no keyboard focus of its own, and a
 * drag can wander (or start) anywhere once Space is held.
 */
export function useSpaceDragPan(panBy: (dx: number, dy: number) => void) {
  /** Space is currently held down (not while typing) -- shows the grab cursor and arms panning on the next pointerdown. */
  const spaceHeld = ref(false)
  /** A pan drag is actively in progress -- shows the grabbing cursor. */
  const panning = ref(false)

  let lastX = 0
  let lastY = 0
  /** A pointer is down (a stroke or drag in progress): Space pressed now must not arm a pan or paint stray cells. */
  let pointerIsDown = false

  function onKeyDown(event: KeyboardEvent) {
    if (!isSpaceKey(event) || isTypingInFormField(event.target) || activatesOnSpace(event.target)) {
      return
    }
    // Without this, holding Space also triggers the browser's own page-down scroll wherever focus happens to be.
    event.preventDefault()
    // Mid-stroke (ticket 424): arming happens on pointerdown, so Space now would only show a grab cursor over a stroke
    // that keeps painting. Ignore it; release and press Space again to pan.
    if (pointerIsDown) {
      return
    }
    spaceHeld.value = true
  }

  function onKeyUp(event: KeyboardEvent) {
    if (!isSpaceKey(event)) {
      return
    }
    spaceHeld.value = false
    panning.value = false
  }

  function onPointerDown(event: PointerEvent) {
    pointerIsDown = true
    // A button the user clicked keeps focus after they move on to the canvas, and would swallow Space (ticket 424).
    // Pressing anywhere but a button hands that focus back; a button reached with Tab keeps it until then.
    const active = document.activeElement
    if (active instanceof HTMLElement && activatesOnSpace(active) && !activatesOnSpace(closestButton(event.target))) {
      active.blur()
    }
    // A press that starts on the Tool pill never moves the canvas (ticket 439).
    if (!spaceHeld.value || (event.target instanceof Element && event.target.closest('[data-tool-pill]'))) {
      return
    }
    panning.value = true
    lastX = event.clientX
    lastY = event.clientY
  }

  function onPointerMove(event: PointerEvent) {
    if (!panning.value) {
      return
    }
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY

    // The canvas moves with the pointer, both ways: the page itself never scrolls (ticket 141).
    panBy(dx, dy)
  }

  function onPointerEnd() {
    pointerIsDown = false
    panning.value = false
  }

  // A held Space surviving a lost window focus (e.g. alt-tabbing away mid-hold) would leave the grab cursor stuck
  // on with no matching keyup ever arriving.
  function onBlur() {
    spaceHeld.value = false
    panning.value = false
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
    window.addEventListener('blur', onBlur)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerEnd)
    window.removeEventListener('pointercancel', onPointerEnd)
    window.removeEventListener('blur', onBlur)
  })

  return { spaceHeld, panning }
}
