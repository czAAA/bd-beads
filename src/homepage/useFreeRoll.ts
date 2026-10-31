import { ref } from 'vue'

// The free list in the No account tile (ticket 0739; Homepage card): scrolled by hand in its short window, a bead lit
// per scroll; on the third the list unrolls below the tile.

/** How many scrolls of the window unroll the list: one per bead beside the count. */
export const SCROLLS_TO_UNROLL = 3

/** Scroll events closer together than this are one scroll: a wheel turn or a swipe sends many. */
const BURST_GAP_MS = 220

/** Counts the free list's scrolls and says when it is unrolled; the page draws the roll and rolls it back up. */
export function useFreeRoll() {
  const lit = ref(0)
  const unrolled = ref(false)
  let inBurst = false
  let ignoring = false
  let burstEnd: ReturnType<typeof setTimeout> | undefined

  /** A scroll event of the window: the first of a burst counts, and the last count unrolls the list at once, so the
   * rest of that same swipe scrolls the page. */
  function onWindowScroll() {
    if (ignoring) {
      ignoring = false
      return
    }
    if (unrolled.value) return
    clearTimeout(burstEnd)
    burstEnd = setTimeout(() => (inBurst = false), BURST_GAP_MS)
    if (inBurst) return
    inBurst = true
    lit.value = Math.min(SCROLLS_TO_UNROLL, lit.value + 1)
    if (lit.value === SCROLLS_TO_UNROLL) unrolled.value = true
  }

  /** The page is about to scroll the window back to its top: that scroll is not the visitor's. */
  function ignoreNextScroll() {
    ignoring = true
  }

  function rollUp() {
    clearTimeout(burstEnd)
    inBurst = false
    unrolled.value = false
    lit.value = 0
  }

  return { lit, unrolled, onWindowScroll, ignoreNextScroll, rollUp }
}
