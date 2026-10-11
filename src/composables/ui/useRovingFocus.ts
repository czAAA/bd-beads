import type { Ref } from 'vue'

/**
 * One Tab stop for a group of buttons, with the arrow keys moving between them (ticket 159; `accessibility.md`,
 * Keyboard): the group's chosen button, or its first, is the one Tab reaches; the others are tabindex -1. The arrows,
 * Home and End only move focus; Space or Enter presses the button as usual.
 */
export function useRovingFocus(container: Ref<HTMLElement | undefined>, selector = 'button') {
  function items(): HTMLElement[] {
    return [...(container.value?.querySelectorAll<HTMLElement>(selector) ?? [])].filter(
      (item) => !(item as HTMLButtonElement).disabled,
    )
  }

  /** tabindex for an item: 0 for the one Tab reaches, -1 for the rest. */
  function tabIndexFor(isStop: boolean): 0 | -1 {
    return isStop ? 0 : -1
  }

  function onKeydown(event: KeyboardEvent) {
    const list = items()
    const current = list.indexOf(document.activeElement as HTMLElement)
    if (current < 0) return
    const last = list.length - 1
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? Math.min(last, current + 1)
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? Math.max(0, current - 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : undefined
    if (next === undefined) return
    event.preventDefault()
    // The app's own hotkeys (Home, arrows) don't also run while moving inside a group.
    event.stopPropagation()
    list[next]!.focus()
  }

  return { onKeydown, tabIndexFor }
}
