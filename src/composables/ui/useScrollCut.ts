import { computed, readonly, ref, watch, type Ref } from 'vue'

/** Which of a scrolling row's edges cut what it holds: none, the start (it is scrolled), the end (more follows) or
 * both. */
export type ScrollCut = 'none' | 'start' | 'end' | 'both'

/** How far a row is scrolled along its axis, how much of it shows and how long it is in all, in pixels. */
export interface ScrollPosition {
  scrolled: number
  shown: number
  whole: number
}

/** A pixel of rounding is not a cut. */
const SLACK = 1

/** Where a row that scrolls along `axis` is, kept up as it scrolls, resizes or changes what it holds. All 0 until
 * mounted. */
export function useScrollPosition(target: Ref<HTMLElement | null | undefined>, axis: () => 'horizontal' | 'vertical' = () => 'horizontal'): Readonly<Ref<ScrollPosition>> {
  const position = ref<ScrollPosition>({ scrolled: 0, shown: 0, whole: 0 })

  watch(
    [target, axis],
    ([row], _, onCleanup) => {
      const measure = () => {
        const [scrolled, shown, whole] = !row ? [0, 0, 0] : axis() === 'vertical' ? [row.scrollTop, row.clientHeight, row.scrollHeight] : [row.scrollLeft, row.clientWidth, row.scrollWidth]
        position.value = { scrolled, shown, whole }
      }
      measure()
      if (!row) return
      // Its scroll, then (where the browser has one) its size and each thing in it: a button shown or hidden inside
      // changes how far it scrolls.
      row.addEventListener('scroll', measure, { passive: true })
      onCleanup(() => row.removeEventListener('scroll', measure))
      if (typeof ResizeObserver === 'undefined') return
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
      onCleanup(() => {
        resizes.disconnect()
        changes.disconnect()
      })
    },
    { immediate: true, flush: 'post' },
  )

  return readonly(position)
}

/** Which edges of a scrolling row cut its content. */
export function scrollCut({ scrolled, shown, whole }: ScrollPosition): ScrollCut {
  const start = scrolled > SLACK
  const end = scrolled + shown < whole - SLACK
  if (start && end) return 'both'
  return start ? 'start' : end ? 'end' : 'none'
}

/** Which edges of a scrolling row cut its content, kept up, so the row can fade the edge where more lies (ticket 0843:
 * the Canvas strip on a phone; ticket 0837: the Tool pill's tools; the strip's panels use `scrollCut` with their thumb;
 * useMoreBelow does the same for a section's foot). 'none' until mounted. */
export function useScrollCut(target: Ref<HTMLElement | null | undefined>, axis: () => 'horizontal' | 'vertical' = () => 'horizontal'): Readonly<Ref<ScrollCut>> {
  const position = useScrollPosition(target, axis)
  return computed(() => scrollCut(position.value))
}
