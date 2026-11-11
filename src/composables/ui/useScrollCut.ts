import { readonly, ref, watch, type Ref } from 'vue'

/** Which of a scrolling row's edges cut what it holds: none, the start (it is scrolled), the end (more follows) or
 * both. */
export type ScrollCut = 'none' | 'start' | 'end' | 'both'

/** A pixel of rounding is not a cut. */
const SLACK = 1

/** Which edges of a row that scrolls along `axis` cut its content, kept up as it scrolls, resizes or changes what it
 * holds, so the row can fade the edge where more lies (ticket 0843: the Canvas strip on a phone; ticket 0837: the Tool
 * pill's tools, docked to any edge; useMoreBelow does the same for a section's foot). 'none' until mounted. */
export function useScrollCut(target: Ref<HTMLElement | null | undefined>, axis: () => 'horizontal' | 'vertical' = () => 'horizontal'): Readonly<Ref<ScrollCut>> {
  const cut = ref<ScrollCut>('none')

  watch(
    [target, axis],
    ([row], _, onCleanup) => {
      const measure = () => {
        const [scrolled, shown, whole] = !row ? [0, 0, 0] : axis() === 'vertical' ? [row.scrollTop, row.clientHeight, row.scrollHeight] : [row.scrollLeft, row.clientWidth, row.scrollWidth]
        const start = scrolled > SLACK
        const end = scrolled + shown < whole - SLACK
        if (start && end) cut.value = 'both'
        else cut.value = start ? 'start' : end ? 'end' : 'none'
      }
      measure()
      if (!row || typeof ResizeObserver === 'undefined') return
      // The row and each thing in it: a button shown or hidden inside changes how far it scrolls.
      const resizes = new ResizeObserver(measure)
      const observeAll = () => {
        resizes.disconnect()
        for (const el of [row, ...row.children]) resizes.observe(el)
      }
      const changes = new MutationObserver(() => {
        observeAll()
        measure()
      })
      observeAll()
      changes.observe(row, { childList: true })
      row.addEventListener('scroll', measure, { passive: true })
      onCleanup(() => {
        row.removeEventListener('scroll', measure)
        resizes.disconnect()
        changes.disconnect()
      })
    },
    { immediate: true, flush: 'post' },
  )

  return readonly(cut)
}
