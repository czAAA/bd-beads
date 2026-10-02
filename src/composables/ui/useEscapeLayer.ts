import { onBeforeUnmount, watch } from 'vue'

/**
 * Escape closes the top-most thing first (ticket 76; `accessibility.md`, Keyboard): a modal, then a sheet or the
 * drawer, then a menu, and only then the app's own Escape (the Selection, an open disclosure row). Every open overlay
 * is a layer on one stack; a single window listener, in the capture phase so it runs before the app's shortcuts,
 * closes the last one opened and keeps the key from everything behind it.
 */
const layers: Array<() => void> = []

function onKeyDown(event: KeyboardEvent) {
  const close = layers.at(-1)
  if (event.key !== 'Escape' || !close) return
  event.preventDefault()
  event.stopImmediatePropagation()
  close()
}

function push(close: () => void) {
  if (layers.length === 0) window.addEventListener('keydown', onKeyDown, true)
  layers.push(close)
}

function remove(close: () => void) {
  const index = layers.lastIndexOf(close)
  if (index < 0) return
  layers.splice(index, 1)
  if (layers.length === 0) window.removeEventListener('keydown', onKeyDown, true)
}

/** Whether a modal, sheet, drawer or menu is open: the app's own Escape and hotkeys wait until none is. */
export function hasOpenLayer(): boolean {
  return layers.length > 0
}

/** Makes this component a layer while `isOpen()` holds; Escape then calls `close`, once it is the top-most one. */
export function useEscapeLayer(isOpen: () => boolean, close: () => void) {
  // A fresh function per component, so two layers sharing a handler still come off the stack one at a time.
  const entry = () => close()
  watch(isOpen, (open) => (open ? push(entry) : remove(entry)), { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => remove(entry))
}
