import { onBeforeUnmount, onMounted } from 'vue'

/** A press, a drag or a key into the demo editor by the beader (Homepage card, What's inside, ticket 0797): the tour
 * stops for the visit. Heard on the window before anything else, so the overlay registry swallowing a press that closes
 * a popover the ghost opened still counts; only a real press counts, never one the ghost made. */
export function useTakeOver(root: () => HTMLElement | undefined, takeOver: () => void): void {
  function onInput(event: Event) {
    const box = root()
    if (event.isTrusted && box && event.target instanceof Node && box.contains(event.target)) takeOver()
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
