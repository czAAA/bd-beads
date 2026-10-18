import { onBeforeUnmount, onMounted } from 'vue'
import { isTypingInFormField } from './useKeyboardShortcuts'

/** A visual viewport scale this close to 1 is no page zoom (Safari's own rounding). */
const PAGE_ZOOM_TOLERANCE = 1.01

/** How long iOS takes to give the keyboard's room back after a field loses focus; a check made sooner finds the view still moved. */
const KEYBOARD_CLOSE_MS = 350

/** Whether the page or the visual viewport has been moved off the screen's origin, with no page zoom to explain it. */
function isMovedOff(): boolean {
  const viewport = window.visualViewport
  // Absent (undefined, not null) in older browsers and in jsdom, so test for it rather than against null.
  const panned = !!viewport && (viewport.offsetLeft !== 0 || viewport.offsetTop !== 0) && viewport.scale <= PAGE_ZOOM_TOLERANCE
  return window.scrollX !== 0 || window.scrollY !== 0 || panned
}

/** Keeps the view at the origin beside the Page zoom lock (ADR 0034): Safari can move it (focus, keyboard, gesture)
 * with nothing to scroll back, so when no field is being typed in it is put back; a page zoom is left alone.
 */
export function useViewportGuard() {
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let keyboardTimer: ReturnType<typeof setTimeout> | undefined

  function settle() {
    settleTimer = undefined
    if (!isTypingInFormField(document.activeElement) && isMovedOff()) window.scrollTo(0, 0)
  }

  function check() {
    settleTimer ??= setTimeout(settle, 0)
  }

  /** A field that loses focus takes the keyboard with it, so check once it has gone. */
  function checkAfterKeyboard() {
    clearTimeout(keyboardTimer)
    keyboardTimer = setTimeout(check, KEYBOARD_CLOSE_MS)
  }

  onMounted(() => {
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('orientationchange', checkAfterKeyboard)
    window.addEventListener('pointerup', check, true)
    window.addEventListener('focusout', checkAfterKeyboard)
    window.visualViewport?.addEventListener('scroll', check)
    window.visualViewport?.addEventListener('resize', checkAfterKeyboard)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', check)
    window.removeEventListener('orientationchange', checkAfterKeyboard)
    window.removeEventListener('pointerup', check, true)
    window.removeEventListener('focusout', checkAfterKeyboard)
    window.visualViewport?.removeEventListener('scroll', check)
    window.visualViewport?.removeEventListener('resize', checkAfterKeyboard)
    clearTimeout(settleTimer)
    clearTimeout(keyboardTimer)
  })
}
