import { shallowRef, watch, type Ref } from 'vue'
import type { Pattern } from '../../domain/pattern'

/** How often, while a stroke is going on, what only summarises the Pattern looks at it again. */
export const SUMMARY_INTERVAL_MS = 250

/**
 * The open Pattern as things that only summarise it should see it (ticket 106): the Pattern itself whenever nothing is
 * being drawn, and, while a stroke is going on, the Pattern as of at most every 250 ms. Painting replaces the Pattern on
 * every bead a stroke crosses, and a summary that reads every bead of a Pattern (how many of each color it needs, the
 * code for sharing it) would be worked out again each time — tens of thousands of beads at 250 × 250, several times a
 * frame. Kept to a few times a second it still reads as live, and it catches up the moment the stroke ends.
 *
 * The first change of a stroke is followed at once, so a single click shows straight away. With an interval of
 * Infinity nothing is followed until the stroke ends, for a summary nobody watches change as it happens.
 *
 * `busy` says whether a stroke is going on; it is read reactively, so the Pattern settles when it turns false.
 */
export function useSettledPattern(
  pattern: () => Pattern | undefined,
  busy: () => boolean,
  intervalMs: number = SUMMARY_INTERVAL_MS,
): Ref<Pattern | undefined> {
  const settled = shallowRef(pattern())
  let followedAt = Number.NEGATIVE_INFINITY
  let timer: ReturnType<typeof setTimeout> | undefined

  function follow(): void {
    clearTimeout(timer)
    timer = undefined
    const current = pattern()
    // A stroke beginning is not yet a change to follow: the first bead it changes is followed at once.
    if (current !== settled.value) {
      settled.value = current
      followedAt = Date.now()
    }
  }

  watch(
    [pattern, busy],
    ([, drawing]) => {
      if (!drawing) {
        follow()
        // Nothing is being drawn, so the first change of the next stroke is followed at once again.
        followedAt = Number.NEGATIVE_INFINITY
        return
      }
      if (!Number.isFinite(intervalMs)) {
        return
      }
      const wait = followedAt + intervalMs - Date.now()
      if (wait <= 0) {
        follow()
      } else if (timer === undefined) {
        timer = setTimeout(follow, wait)
      }
    },
    { flush: 'sync' },
  )

  return settled
}
