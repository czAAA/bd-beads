import { readonly, ref, watch, type Ref } from 'vue'

/** Which ends of a scrolling row cut what it holds: none, the start (it is scrolled), the end (more follows) or both. */
export type ScrollEdges = 'none' | 'start' | 'end' | 'both'

/** A pixel of rounding is not a cut. */
const SLACK = 1

/** Which ends of a row that scrolls along `axis` cut its content, kept up as it scrolls, resizes or changes what it holds,
 * so the row can fade the end where more lies (ticket 0837: the Tool pill's tools on a phone, docked to any edge).
 * 'none' until mounted. */
export function useScrollEdges(target: Ref<HTMLElement | null | undefined>, axis: () => 'horizontal' | 'vertical'): Readonly<Ref<ScrollEdges>> {
  const edges = ref<ScrollEdges>('none')

  watch(
    [target, axis],
    ([row], _, onCleanup) => {
      const measure = () => {
        if (!row) return void (edges.value = 'none')
        const [scrolled, shown, whole] = axis() === 'vertical' ? [row.scrollTop, row.clientHeight, row.scrollHeight] : [row.scrollLeft, row.clientWidth, row.scrollWidth]
        const start = scrolled > SLACK
        const end = scrolled + shown < whole - SLACK
        edges.value = start && end ? 'both' : start ? 'start' : end ? 'end' : 'none'
      }
      measure()
      if (!row || typeof ResizeObserver === 'undefined') return
      // The row and each thing in it: a tile shown or hidden inside changes how far it scrolls.
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

  return readonly(edges)
}
