import { onBeforeUnmount, onMounted } from 'vue'

/** A press, a drag or a key into the demo editor by the beader (What's inside, ticket 0797): the tour stops for the
 * visit. Heard on the window first, so a press the overlay registry swallows (closing a popover the ghost opened) still
 * counts; only a real press does, never the ghost's, nor one on the page's own control in the box (`pagesOwn`, 0830). */
export function useTakeOver(root: () => HTMLElement | undefined, takeOver: () => void, pagesOwn: (target: Element) => boolean = () => false): void {
  function onInput(event: Event) {
    const box = root()
    if (!event.isTrusted || !box || !(event.target instanceof Node) || !box.contains(event.target)) return
    if (event.target instanceof Element && pagesOwn(event.target)) return
    takeOver()
  }
  onMounted(() => {
    window.addEventListener('pointerdown', onInput, true)
    window.addEventListener('keydown', onInput, true)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onInput, true)
    window.removeEventListener('keydown', onInput, true)
  })
}
