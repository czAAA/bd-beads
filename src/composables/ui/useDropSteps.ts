import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref, type WatchSource } from 'vue'

/**
 * How many of a row's labels, in priority order (least important first), have to drop for its content to fit on one
 * line -- the ContextBar card's "drops labels right to left" (responsive.md, Fitting longer text). Generalizes
 * useFitByPriority's single yes/no step to `stepCount` steps: each candidate (one more label dropped than before) is
 * rendered and measured in turn, stopping as soon as it fits; it steps back the same way as room returns, so it
 * doesn't flicker between two widths that are both borderline.
 */
export function useDropSteps(rowEl: Ref<HTMLElement | undefined>, stepCount: number, watchSources: WatchSource[] = []): Ref<number> {
  const dropped = ref(0)
  let measuring = false

  function fits(row: HTMLElement): boolean {
    return row.scrollWidth <= row.clientWidth
  }

  async function measure() {
    if (measuring) return
    measuring = true
    try {
      let row = rowEl.value
      while (row && dropped.value < stepCount && !fits(row)) {
        dropped.value += 1
        await nextTick()
        row = rowEl.value
      }
      while (row && dropped.value > 0) {
        const restored = dropped.value - 1
        dropped.value = restored
        await nextTick()
        row = rowEl.value
        if (!row || !fits(row)) {
          dropped.value = restored + 1
          await nextTick()
          break
        }
      }
    } finally {
      measuring = false
    }
  }

  let observer: ResizeObserver | undefined
  onMounted(() => {
    if (typeof ResizeObserver === 'undefined' || !rowEl.value) return
    observer = new ResizeObserver(() => void measure())
    observer.observe(rowEl.value)
    void measure()
  })
  onBeforeUnmount(() => observer?.disconnect())

  watch(watchSources, () => {
    dropped.value = 0
    void nextTick(measure)
  })

  return dropped
}
