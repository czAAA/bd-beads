import { nextTick, watch, type Ref } from 'vue'
import { useMediaQuery } from './useMediaQuery'

/** Scrolls a part that opened in place into view, the least it takes (ticket 0862): Convert image's Color by color and
 * a found color's Change picker, which open under the pane's fold. Smooth, a jump under reduced motion; the part's own
 * `scroll-margin-top` keeps it clear of what is pinned at the pane's top. */
export function useRevealWhenOpen(target: Ref<HTMLElement | undefined>, isOpen: () => boolean): void {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  watch(isOpen, async (open) => {
    if (!open) return
    await nextTick()
    target.value?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion.value ? 'auto' : 'smooth' })
  })
}
