import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

// Places a popup 4px under its button (Menu card), `fixed` from its first render so it never pushes the button aside in
// its row (ticket 0681), since the left column scrolls and would clip it. Opens above when no room below, stays inside
// the window, follows the button. A `transform` ancestor (open Drawer) shifts `fixed`: measured and corrected (246).
export function useAnchoredPosition(anchor: Ref<HTMLElement | undefined>, popup: Ref<HTMLElement | undefined>, align: () => 'start' | 'end') {
  const style = ref<Record<string, string>>({ position: 'fixed', top: '0px', left: '0px', right: 'auto' })
  const GAP = 4
  const EDGE = 8
  let offsetX = 0
  let offsetY = 0

  function place(settled = false) {
    const button = anchor.value?.getBoundingClientRect()
    const list = popup.value
    if (!button || !list) return
    const height = list.offsetHeight
    const below = window.innerHeight - button.bottom
    const top = below < height + GAP && button.top > below ? button.top - GAP - height : button.bottom + GAP
    // At least as wide as the button it hangs from.
    const minWidth = `${button.width}px`
    const width = Math.max(list.offsetWidth, button.width)
    const wanted = align() === 'end' ? button.right - width : button.left
    const left = Math.max(EDGE, Math.min(wanted, window.innerWidth - width - EDGE))
    const apply = () => {
      style.value = { position: 'fixed', top: `${top - offsetY}px`, left: `${left - offsetX}px`, right: 'auto', minWidth }
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
  return { style, follow, stop }
}
