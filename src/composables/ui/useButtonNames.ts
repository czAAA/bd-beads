import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import { useOverlayLayer } from './useOverlayLayer'

/** Where a Tooltip's control must sit for What the buttons do to name it: the Canvas strip and the Tool pill. */
export const BUTTON_NAMES_AREA = '[data-button-names]'

/** A box on the screen, as a bubble is placed. */
export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** What the Tooltips of a shell read while What the buttons do shows: whether it shows, and where the bubbles already
 * stand, so the next one steps clear of them. */
interface ButtonNames {
  shown: Readonly<Ref<boolean>>
  placed: Map<string, Box>
}

const buttonNamesKey: InjectionKey<ButtonNames> = Symbol('buttonNames')

/** Menu › Help › What the buttons do (ticket 0927): every strip and pill button shows its Tooltip's name at once, over
 * the shell, until the next press or Escape, which the overlay registry takes (it is a layer with nothing inside). */
export function provideButtonNames() {
  const shown = ref(false)
  const placed = new Map<string, Box>()
  /** The layer's own element: in no page, so every press is outside it. */
  const nowhere = typeof document === 'undefined' ? undefined : document.createElement('span')

  function show() {
    placed.clear()
    shown.value = true
  }

  function hide() {
    shown.value = false
    placed.clear()
  }

  useOverlayLayer({ isOpen: () => shown.value, root: () => nowhere, close: hide })
  provide(buttonNamesKey, { shown, placed })
  return { shown, show, hide }
}

/** The shell's What the buttons do, for a Tooltip to show its name in; none outside a shell (a test, the Homepage). */
export function useButtonNames(): ButtonNames | undefined {
  return inject(buttonNamesKey, undefined)
}

/** Whether two boxes overlap. */
function overlaps(a: Box, b: Box): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height
}

/** The top for a bubble at `box` that clears the bubbles already placed, stepping away from its control (`down` or up)
 * a bubble's height and `gap` at a time; at most `steps` steps, so a crowd can't push it off the screen. */
export function clearOfPlaced(box: Box, others: Iterable<Box>, down: boolean, gap: number, steps = 3): number {
  const list = [...others]
  let top = box.top
  for (let step = 0; step < steps && list.some((other) => overlaps({ ...box, top }, other)); step++) top += (down ? 1 : -1) * (box.height + gap)
  return top
}
