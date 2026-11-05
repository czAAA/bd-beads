import { onBeforeUnmount, watch } from 'vue'
import { swallowNextClick } from './swallowNextClick'
import { inScope, PAGE_SCOPE, useShellScope, type ShellScope } from './shellScope'

// The overlay registry (ticket 76 Escape; ticket 449, ADR 0061 press outside): every open overlay is a layer on one stack;
// Escape and a press outside (click swallowed) close the top-most, its opener and a dialog raised from it exempt. A boxed
// shell's layer (ticket 0797) hears only what happens in its box, the page's layers everything.
export interface OverlayLayerOptions {
  /** Whether the overlay is open; it is a layer only while this holds. */
  isOpen: () => boolean
  /** The overlay's own element: a press inside it is not outside. */
  root: () => Element | null | undefined
  /** Escape, and by default a press outside. */
  close: () => void
  /** A press outside swallows and, with `'swallow'`, does not close (a modal that demands an answer); with `'through'`
   * it closes and the press goes on (the paper tag over the canvas, ticket 0721). */
  outside?: 'close' | 'swallow' | 'through'
  /** What a press outside does instead of `close` (a sheet notes it was closed by a press, ticket 424). */
  onOutsidePress?: () => void
  /** Whether a target is the overlay's own opener, which toggles the overlay itself. */
  isOpener?: (target: Element) => boolean
  /** Whether a press outside still works the overlay's own thing, so it goes through and the overlay stays (the
   * Frame panel's handles on the canvas, ticket 475). */
  keepsPress?: (event: PointerEvent) => boolean
}

type Layer = OverlayLayerOptions & { scope: ShellScope }

const layers: Layer[] = []

/** The top-most layer an event's target is the business of. */
function topFor(target: EventTarget | null): Layer | undefined {
  for (let index = layers.length - 1; index >= 0; index--) if (inScope(layers[index].scope, target)) return layers[index]
  return undefined
}

const DIALOG = '[role="dialog"], [role="alertdialog"]'

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  const top = topFor(event.target)
  if (!top) return
  event.preventDefault()
  event.stopImmediatePropagation()
  top.close()
}

/** Whether the press lands in something the layer must leave alone. */
function isExempt(top: Layer, target: Element): boolean {
  if (top.isOpener?.(target)) return true
  // A dialog raised from the layer is its own business, unless it is one of the layers beneath (then it is outside).
  const dialog = target.closest(DIALOG)
  return dialog !== null && !layers.some((layer) => layer.root()?.contains(dialog))
}

function onPointerDown(event: PointerEvent) {
  const target = event.target
  const top = topFor(target)
  // A pinch's second finger is not a press.
  if (!top || (event.pointerType === 'touch' && !event.isPrimary) || !(target instanceof Element)) return
  const root = top.root()
  if (!root || root.contains(target) || isExempt(top, target) || top.keepsPress?.(event)) return
  if (top.outside === 'through') return (top.onOutsidePress ?? top.close)()
  event.stopPropagation()
  event.preventDefault()
  swallowNextClick()
  if (top.outside === 'swallow') return
  ;(top.onOutsidePress ?? top.close)()
}

function push(layer: Layer) {
  if (layers.length === 0) {
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('pointerdown', onPointerDown, true)
  }
  layers.push(layer)
}

function remove(layer: Layer) {
  const index = layers.lastIndexOf(layer)
  if (index < 0) return
  layers.splice(index, 1)
  if (layers.length === 0) {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('pointerdown', onPointerDown, true)
  }
}

/** Whether a modal, sheet, drawer or menu of a shell is open, the page's by default: its own Escape and hotkeys wait until
 * none is. */
export function hasOpenLayer(scope: ShellScope = PAGE_SCOPE): boolean {
  return layers.some((layer) => layer.scope === scope)
}

/** Makes this component a layer while `isOpen()` holds; Escape and a press outside then act on it once it is the
 * top-most one. */
export function useOverlayLayer(options: OverlayLayerOptions) {
  // A fresh object per component, so two layers sharing a handler still come off the stack one at a time.
  const layer = { ...options, scope: useShellScope() }
  watch(options.isOpen, (open) => (open ? push(layer) : remove(layer)), { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => remove(layer))
}
