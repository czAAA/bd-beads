import { onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * Places a popup (a Menu, a popover) against the button it belongs to, 4px under it (Menu card), on the page itself
 * rather than inside the box that holds the button: the left column scrolls on its own and would clip it. When there
 * isn't room below, it opens above instead. It follows the button while anything scrolls or the window resizes.
 */
export function useAnchoredPosition(anchor: Ref<HTMLElement | undefined>, popup: Ref<HTMLElement | undefined>, align: () => 'start' | 'end') {
  const style = ref<Record<string, string>>({})
  const GAP = 4

  function place() {
    const button = anchor.value?.getBoundingClientRect()
    const list = popup.value
    if (!button || !list) return
    const height = list.offsetHeight
    const below = window.innerHeight - button.bottom
    const top = below < height + GAP && button.top > below ? button.top - GAP - height : button.bottom + GAP
    // At least as wide as the button it hangs from.
    const minWidth = `${button.width}px`
    style.value =
      align() === 'end'
        ? { position: 'fixed', top: `${top}px`, right: `${window.innerWidth - button.right}px`, left: 'auto', minWidth }
        : { position: 'fixed', top: `${top}px`, left: `${button.left}px`, right: 'auto', minWidth }
  }

  function follow() {
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
  }

  function stop() {
    window.removeEventListener('scroll', place, true)
    window.removeEventListener('resize', place)
  }

  onBeforeUnmount(stop)
  return { style, follow, stop }
}
