import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref, type WatchSource } from 'vue'

/**
 * Whether a row that must stay on one line has to take its first fitting step (ticket 142; `writing.md`, Fitting longer
 * text): true once its content is wider than the row. It remembers how wide the full content needed, and steps back
 * only when the row is at least that wide again, so the header doesn't flicker between the two. `watchSources` are what
 * can change the content's width (the language, whether a Project is open).
 */
export function useFitByPriority(rowEl: Ref<HTMLElement | undefined>, watchSources: WatchSource[] = []): Ref<boolean> {
  const stepped = ref(false)
  let neededWidth = 0

  function measure() {
    const row = rowEl.value
    if (!row) return
    if (!stepped.value && row.scrollWidth > row.clientWidth) {
      neededWidth = row.scrollWidth
      stepped.value = true
    } else if (stepped.value && row.clientWidth >= neededWidth) {
      stepped.value = false
      // The full content may have changed since it was measured: check again once it is back.
      void nextTick(measure)
    }
  }

  let observer: ResizeObserver | undefined
  onMounted(() => {
    if (typeof ResizeObserver === 'undefined' || !rowEl.value) return
    observer = new ResizeObserver(measure)
    observer.observe(rowEl.value)
    measure()
  })
  onBeforeUnmount(() => observer?.disconnect())

  watch(watchSources, () => {
    // New content: start from the full labels again and see whether they fit.
    stepped.value = false
    neededWidth = 0
    void nextTick(measure)
  })

  return stepped
}
