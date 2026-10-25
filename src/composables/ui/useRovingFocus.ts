import { onMounted, onUpdated, type Ref } from 'vue'

/** Which arrows step through a group: the pair along its axis, or both pairs for a grid-like group. */
type RovingAxis = 'horizontal' | 'vertical' | 'both'

interface RovingOptions {
  selector?: string
  /** Read on every key, so a group that changes its axis (the Tool pill docking to another edge) follows. */
  axis?: () => RovingAxis
  /** The group sets its own tabindex: the last focused item (else the first) is the Tab stop, the rest -1. Without it
   * the owner binds `tabIndexFor` itself. */
  managesTabIndex?: boolean
}

// One Tab stop for a group of buttons, arrow keys moving between them (ticket 159, ADR 0075; `accessibility.md`,
// Keyboard): the chosen or first button is the Tab stop, the rest tabindex -1. The arrows of the group's axis, Home and
// End only move focus, stopping at the ends; the other axis does nothing. Space or Enter presses as usual.
export function useRovingFocus(container: Ref<HTMLElement | undefined>, options: RovingOptions = {}) {
  const { selector = 'button', axis = () => 'both', managesTabIndex = false } = options
  let stop: HTMLElement | undefined

  function items(): HTMLElement[] {
    return [...(container.value?.querySelectorAll<HTMLElement>(selector) ?? [])].filter(
      (item) => !(item as HTMLButtonElement).disabled && item.checkVisibility?.() !== false,
    )
  }

  /** tabindex for an item: 0 for the one Tab reaches, -1 for the rest. */
  function tabIndexFor(isStop: boolean): 0 | -1 {
    return isStop ? 0 : -1
  }

  /** Puts the Tab stop on the last focused item, or the first when it is gone (`managesTabIndex` groups). */
  function syncStops() {
    const list = items()
    const keep = stop && list.includes(stop) ? stop : list[0]
    for (const item of list) item.tabIndex = item === keep ? 0 : -1
  }

  function onFocusin(event: FocusEvent) {
    if (!managesTabIndex) return
    const target = event.target as HTMLElement
    if (!items().includes(target)) return
    stop = target
    syncStops()
  }

  function onKeydown(event: KeyboardEvent) {
    const list = items()
    const current = list.indexOf(document.activeElement as HTMLElement)
    if (current < 0) return
    const last = list.length - 1
    const along = axis()
    const forward = (along !== 'vertical' && event.key === 'ArrowRight') || (along !== 'horizontal' && event.key === 'ArrowDown')
    const back = (along !== 'vertical' && event.key === 'ArrowLeft') || (along !== 'horizontal' && event.key === 'ArrowUp')
    const next = forward ? Math.min(last, current + 1) : back ? Math.max(0, current - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : undefined
    if (next === undefined) return
    event.preventDefault()
    // The app's own hotkeys (Home, arrows) don't also run while moving inside a group.
    event.stopPropagation()
    list[next]!.focus()
  }

  if (managesTabIndex) {
    onMounted(syncStops)
    onUpdated(syncStops)
  }

  return { onKeydown, onFocusin, tabIndexFor }
}
