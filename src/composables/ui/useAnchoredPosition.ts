import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

/** `fixed` at a place; `right: auto` so a popup's own CSS `right` (an end-aligned Menu) doesn't stretch it. */
const fixedAt = (top: number, left: number) => ({ position: 'fixed', top: `${top}px`, left: `${left}px`, right: 'auto' })

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

// Places a popup 4px under its button (Menu card), `fixed` from its first render so it never pushes the button aside in
// its row (ticket 0681), since the left column scrolls and would clip it. Opens on the other side when no room on its
// own, stays inside the window, follows the button. A `transform` ancestor (open Drawer) shifts `fixed`: corrected (246).
export function useAnchoredPosition(anchor: Ref<HTMLElement | undefined>, popup: Ref<HTMLElement | undefined>, align: () => 'start' | 'end', side: () => 'below' | 'above' = () => 'below') {
  const style = ref<Record<string, string>>(fixedAt(0, 0))
  const GAP = 4
  const EDGE = 8
  let offsetX = 0
  let offsetY = 0

  function place(settled = false) {
    const button = anchor.value?.getBoundingClientRect()
    const list = popup.value
    if (!button || !list) return
    raise(list)
    const height = list.offsetHeight
    const below = window.innerHeight - button.bottom
    const above = button.top
    const up = side() === 'above' ? above >= height + GAP || above > below : below < height + GAP && above > below
    const top = up ? button.top - GAP - height : button.bottom + GAP
    // At least as wide as the button it hangs from.
    const minWidth = `${button.width}px`
    const width = Math.max(list.offsetWidth, button.width)
    const wanted = align() === 'end' ? button.right - width : button.left
    const left = Math.max(EDGE, Math.min(wanted, window.innerWidth - width - EDGE))
    const apply = () => {
      style.value = { ...fixedAt(top - offsetY, left - offsetX), minWidth }
    }
    apply()
    void nextTick(() => {
      const placed = popup.value?.getBoundingClientRect()
      if (!placed) return
      // Once `fixed`, the list may take a different width than it had inside its button's box (ticket 368: a narrow
      // button in a sheet), which moves an end-aligned popup: place it again with the real width before measuring.
      if (!settled && Math.abs(placed.width - width) > 0.5) {
        place(true)
        return
      }
      const dx = placed.left - left
      const dy = placed.top - top
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
      offsetX += dx
      offsetY += dy
      apply()
    })
  }

  const onMove = () => place()

  function follow() {
    place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
  }

  function stop() {
    window.removeEventListener('scroll', onMove, true)
    window.removeEventListener('resize', onMove)
  }

  onBeforeUnmount(stop)
  /** `place` again where the button moves without a scroll, as on the canvas when it is panned (ticket 0698). */
  return { style, follow, stop, place: () => place() }
}
