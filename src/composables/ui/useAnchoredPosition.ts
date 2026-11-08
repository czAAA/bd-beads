import { autoUpdate, computePosition, flip, offset, shift, type Placement } from '@floating-ui/vue'
import { onBeforeUnmount, ref, type Ref } from 'vue'
import { PAGE_SCOPE, scopeRoom, useShellScope } from './shellScope'

/** `fixed` at a place; `right: auto` so a popup's own CSS `right` (an end-aligned Menu) doesn't stretch it. */
const fixedAt = (top: number, left: number) => ({ position: 'fixed', top: `${top}px`, left: `${left}px`, right: 'auto' })

/** Clear until it has its place (not `visibility: hidden`, which can't take focus), so no frame shows it at the window's corner (ticket 0804). */
const unplaced = { ...fixedAt(0, 0), opacity: '0' }

/** Whether this browser has popovers (a test DOM may not). */
const topLayer = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype

/** Puts a popup marked `popover` in the top layer, as the Tooltip's bubble is, where no ancestor's `transform` (the
 * margin sheet's scale, ticket 0698) shrinks it or moves it; a browser without popovers keeps it where it is. */
function raise(popup: HTMLElement): void {
  if (!topLayer || !popup.hasAttribute('popover') || popup.matches(':popover-open')) return
  try {
    popup.showPopover()
  } catch {
    // Already open, or left the page.
  }
}

// Places a popup 4px under its button (Menu card) with Floating UI, `fixed` from its first render so it never pushes the
// button aside in its row (ticket 0681), since the left column scrolls and would clip it. Opens on the other side when no
// room on its own, stays inside the window (or a boxed shell's box, ticket 0797), follows the button while it moves.
export function useAnchoredPosition(anchor: Ref<HTMLElement | undefined>, popup: Ref<HTMLElement | undefined>, align: () => 'start' | 'end', side: () => 'below' | 'above' = () => 'below') {
  const style = ref<Record<string, string>>(unplaced)
  /** How tall the popup may be below its top, inside a boxed shell's box (ticket 0797); none on the page. */
  const roomBelow = ref<number>()
  const scope = useShellScope()
  const GAP = 4
  const EDGE = 8
  let stopUpdating: (() => void) | undefined
  /** Bumped by every call, so a slow `computePosition` never overwrites a newer one. */
  let latest = 0

  async function place() {
    const button = anchor.value
    const list = popup.value
    if (!button || !list) return
    raise(list)
    const room = scopeRoom(scope)
    // At least as wide as the button it hangs from.
    const minWidth = `${button.getBoundingClientRect().width}px`
    if (list.style.minWidth !== minWidth) list.style.minWidth = minWidth
    const placement: Placement = `${side() === 'above' ? 'top' : 'bottom'}-${align() === 'end' ? 'end' : 'start'}`
    const mine = ++latest
    const { x, y } = await computePosition(button, list, {
      strategy: 'fixed',
      placement,
      middleware: [
        offset(GAP),
        flip({ boundary: [], rootBoundary: { x: room.left, y: room.top, width: room.right - room.left, height: room.bottom - room.top }, padding: 0 }),
        shift({ boundary: [], rootBoundary: { x: room.left, y: room.top, width: room.right - room.left, height: room.bottom - room.top }, padding: EDGE }),
      ],
    })
    if (mine !== latest) return
    // `y` is from the popup's containing block, which a boxed shell's box is (`contain`), the room's bottom from the
    // screen's top: the block's own top joins them.
    const blockTop = list.getBoundingClientRect().top - (Number.parseFloat(list.style.top) || 0)
    roomBelow.value = scope === PAGE_SCOPE ? undefined : room.bottom - (y + blockTop) - EDGE
    style.value = { ...fixedAt(y, x), minWidth }
  }

  function follow() {
    stop()
    const button = anchor.value
    const list = popup.value
    if (!button || !list) return
    style.value = unplaced
    // Also follows a button a canvas pan or zoom moves without a `scroll` (ticket 0698): it watches the button's box.
    stopUpdating = autoUpdate(button, list, () => void place())
  }

  function stop() {
    stopUpdating?.()
    stopUpdating = undefined
  }

  onBeforeUnmount(stop)
  /** `place` again where the button moves, when not following. */
  return { style, roomBelow, follow, stop, place: () => void place() }
}
