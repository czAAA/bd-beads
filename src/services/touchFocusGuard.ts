// The runtime backstop of ticket 520: on a touch device a phone or tablet's keyboard rises only when the person taps a
// text field. Lint (no-self-raised-keyboard) closes the doors in our code; this closes a library's or a loophole's.

/** How long after a press or key a programmatic focus still counts as the person's doing (a tap that opens a field,
 * then focuses it a tick later). */
const GESTURE_WINDOW_MS = 1000
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

function isTextField(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(element.type)
  const editable = element.getAttribute('contenteditable')
  return editable !== null && editable !== 'false'
}

/** Makes `focus()` on a text field do nothing on a touch device unless a press or key came just before; mouse devices
 * and every other element are untouched. Returns the way to take it off. */
export function installTouchFocusGuard(win: Window & typeof globalThis = window): () => void {
  const prototype = win.HTMLElement.prototype
  const nativeFocus = prototype.focus
  let lastGesture = -Infinity
  const note = () => {
    lastGesture = Date.now()
  }
  const gestures = ['pointerdown', 'touchstart', 'click', 'keydown'] as const
  gestures.forEach((type) => win.addEventListener(type, note, true))

  prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
    const touch = typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches
    if (touch && isTextField(this) && Date.now() - lastGesture > GESTURE_WINDOW_MS) return
    nativeFocus.call(this, options)
  }

  return () => {
    prototype.focus = nativeFocus
    gestures.forEach((type) => win.removeEventListener(type, note, true))
  }
}
