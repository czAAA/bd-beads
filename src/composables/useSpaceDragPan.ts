import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { isTypingInFormField } from './useKeyboardShortcuts'

/**
 * Whether Space has a native meaning at `target` that panning must not steal -- a focused button (every Toolbox
 * control) activates on Space in every browser, so hijacking the key there would silently break keyboard-only use
 * of the Toolbox, not just cursor-driven panning.
 */
function activatesOnSpace(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button')
}

/**
 * Holding Space and dragging pans the canvas panel's viewport (ticket 95): a pure scroll, regardless of which tool
 * is active — never a paint/fill/erase/select, so callers guard their own cell handlers with `spaceHeld` rather
 * than this composable trying to intercept those events itself. Both directions land on `scrollEl` (the canvas
 * box's own scroller, `.app-shell__canvas-scroll` in App.vue): the page itself never scrolls (ticket 141).
 * Bound to the window, the same way useKeyboardShortcuts is: the canvas takes no keyboard focus of its own, and a
 * drag can wander (or start) anywhere once Space is held.
 */
export function useSpaceDragPan(scrollEl: Ref<HTMLElement | null>) {
  /** Space is currently held down (not while typing) -- shows the grab cursor and arms panning on the next pointerdown. */
  const spaceHeld = ref(false)
  /** A pan drag is actively in progress -- shows the grabbing cursor. */
  const panning = ref(false)

  let lastX = 0
  let lastY = 0

  function onKeyDown(event: KeyboardEvent) {
    if (event.code !== 'Space' || isTypingInFormField(event.target) || activatesOnSpace(event.target)) {
      return
    }
    // Without this, holding Space also triggers the browser's own page-down scroll wherever focus happens to be.
    event.preventDefault()
    spaceHeld.value = true
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.code !== 'Space') {
      return
    }
    spaceHeld.value = false
    panning.value = false
  }

  function onPointerDown(event: PointerEvent) {
    if (!spaceHeld.value) {
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

    // The Pattern scrolls inside the canvas box both ways (ticket 141): the page itself never does.
    if (scrollEl.value) {
      scrollEl.value.scrollLeft -= dx
      scrollEl.value.scrollTop -= dy
    }
  }

  function onPointerEnd() {
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
