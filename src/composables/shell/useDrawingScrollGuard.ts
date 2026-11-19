import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/** The attribute that marks a box in the drawing area as never scrolled, whatever its CSS says (ticket 1107). */
const NO_SCROLL_ATTRIBUTE = 'data-no-scroll'

const SCROLLS = new Set(['auto', 'scroll'])

/** Whether a box may keep a scroll: its CSS lets it scroll and nothing marks it as one that never does. */
function scrollsOnPurpose(box: Element): boolean {
  if (box.hasAttribute(NO_SCROLL_ATTRIBUTE)) return false
  const style = getComputedStyle(box)
  return SCROLLS.has(style.overflowX) || SCROLLS.has(style.overflowY)
}

/** Keeps the drawing under what sits on it (ticket 1107): the browser can scroll a clipping box (focus, a key), sliding
 * the drawn Canvas away from the margin sheet's band and the title block. Nothing in the drawing area scrolls natively
 * (ADR 0026), so such a box is put straight back; a list or popover whose CSS scrolls keeps its scroll. */
export function useDrawingScrollGuard(area: Ref<HTMLElement | undefined>) {
  function putBack(event: Event) {
    const box = event.target
    if (!(box instanceof Element) || scrollsOnPurpose(box)) return
    if (box.scrollTop !== 0) box.scrollTop = 0
    if (box.scrollLeft !== 0) box.scrollLeft = 0
  }

  // Scroll doesn't bubble, so the area listens as it is captured.
  let listening: HTMLElement | undefined
  onMounted(() => {
    listening = area.value
    listening?.addEventListener('scroll', putBack, { capture: true, passive: true })
  })
  onBeforeUnmount(() => listening?.removeEventListener('scroll', putBack, true))
}
