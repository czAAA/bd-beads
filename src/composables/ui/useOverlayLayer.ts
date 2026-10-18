import { onBeforeUnmount, watch } from 'vue'
import { inTourCard } from './tourDom'
import { swallowNextClick } from './swallowNextClick'

// The overlay registry (ticket 76 Escape; ticket 449, ADR 0061 press outside). Every open overlay is a layer on one
// stack; two capture listeners act on the top-most only: Escape closes it, a press outside closes it (click swallowed).
// Exempt: the opener, a dialog raised from it, the Tour card.
export interface OverlayLayerOptions {
  /** Whether the overlay is open; it is a layer only while this holds. */
  isOpen: () => boolean
  /** The overlay's own element: a press inside it is not outside. */
  root: () => Element | null | undefined
  /** Escape, and by default a press outside. */
  close: () => void
  /** A press outside swallows and, with `'swallow'`, does not close (a modal that demands an answer). */
  outside?: 'close' | 'swallow'
  /** What a press outside does instead of `close` (a sheet notes it was closed by a press, ticket 424). */
  onOutsidePress?: () => void
  /** Whether a target is the overlay's own opener, which toggles the overlay itself. */
  isOpener?: (target: Element) => boolean
  /** Whether a press outside still works the overlay's own thing, so it goes through and the overlay stays (the
   * Frame bar's handles on the canvas, ticket 475). */
  keepsPress?: (event: PointerEvent) => boolean
}

const layers: OverlayLayerOptions[] = []

const DIALOG = '[role="dialog"], [role="alertdialog"]'

function onKeyDown(event: KeyboardEvent) {
  const top = layers.at(-1)
  if (event.key !== 'Escape' || !top) return
  event.preventDefault()
  event.stopImmediatePropagation()
  top.close()
}

/** Whether the press lands in something the layer must leave alone. */
function isExempt(top: OverlayLayerOptions, target: Element): boolean {
  if (inTourCard(target) || top.isOpener?.(target)) return true
  // A dialog raised from the layer is its own business, unless it is one of the layers beneath (then it is outside).
  const dialog = target.closest(DIALOG)
  return dialog !== null && !layers.some((layer) => layer.root()?.contains(dialog))
}

function onPointerDown(event: PointerEvent) {
  const top = layers.at(-1)
  const target = event.target
  // A pinch's second finger is not a press.
  if (!top || (event.pointerType === 'touch' && !event.isPrimary) || !(target instanceof Element)) return
  const root = top.root()
  if (!root || root.contains(target) || isExempt(top, target) || top.keepsPress?.(event)) return
  event.stopPropagation()
  event.preventDefault()
  swallowNextClick()
  if (top.outside === 'swallow') return
  ;(top.onOutsidePress ?? top.close)()
}

function push(layer: OverlayLayerOptions) {
  if (layers.length === 0) {
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('pointerdown', onPointerDown, true)
  }
  layers.push(layer)
}

function remove(layer: OverlayLayerOptions) {
  const index = layers.lastIndexOf(layer)
  if (index < 0) return
  layers.splice(index, 1)
  if (layers.length === 0) {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('pointerdown', onPointerDown, true)
  }
}

/** Whether a modal, sheet, drawer or menu is open: the app's own Escape and hotkeys wait until none is. */
export function hasOpenLayer(): boolean {
  return layers.length > 0
}

/** Makes this component a layer while `isOpen()` holds; Escape and a press outside then act on it once it is the
 * top-most one. */
export function useOverlayLayer(options: OverlayLayerOptions) {
  // A fresh object per component, so two layers sharing a handler still come off the stack one at a time.
  const layer = { ...options }
  watch(options.isOpen, (open) => (open ? push(layer) : remove(layer)), { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => remove(layer))
}
