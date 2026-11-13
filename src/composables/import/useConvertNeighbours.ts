import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Grid } from '../../domain/project'
import { MIN_IMAGE_COLORS } from '../../domain/imageConversion'

/** What the neighbours read from the wizard: the count shown and the most there can be, whether the card is on screen,
 * the beads at another count, and the beads shown now. */
export interface ConvertNeighboursDeps {
  count: Ref<number>
  most: Ref<number>
  shown: Ref<boolean>
  beadsAt: (count: number) => Grid
  beadsShown: Ref<Grid>
}

/** One side's place: the end of the range, or its count with the beads last drawn there (none until the first are), and
 * whether they are the beads at that count and the same as those shown, so taking it would change nothing. */
export type NeighbourPlace = { end: true; count: number } | { end: false; count: number; beads: Grid | undefined; same: boolean }

/** How long the count rests before the neighbours follow it (DS-2: about 150 ms). @internal The tests wait it out. */
export const NEIGHBOURS_REST_MS = 150

/** Whether two grids hold the same beads, place by place. */
function sameBeads(a: Grid, b: Grid): boolean {
  return a.length === b.length && a.every((row, at) => row.length === b[at]!.length && row.every((cell, column) => cell.color === b[at]![column]!.color))
}

/** The Colors neighbours (ConvertImage card DS-2, ticket 0904): the beads at one color fewer and one more, each the page's
 * own conversion. They follow the count once it rests, one after the other, each kept until the next is drawn, and only
 * while the card shows, so the main beads stay as fast while the slider moves. */
export function useConvertNeighbours({ count, most, shown, beadsAt, beadsShown }: ConvertNeighboursDeps) {
  const fewerAt = ref<number>()
  const moreAt = ref<number>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => clearTimeout(timer)

  watch(
    [shown, count],
    ([on, now]) => {
      stop()
      if (!on) {
        // Hidden, the drawn ones go: the settings may change before the card shows again.
        fewerAt.value = moreAt.value = undefined
        return
      }
      timer = setTimeout(() => {
        fewerAt.value = now - 1
        // The second in a task of its own, so the first is drawn before it is worked out.
        timer = setTimeout(() => (moreAt.value = now + 1))
      }, NEIGHBOURS_REST_MS)
    },
    { immediate: true },
  )
  onScopeDispose(stop)

  const inRange = (at: number) => at >= MIN_IMAGE_COLORS && at <= most.value
  const drawnAt = (at: Ref<number | undefined>) => computed(() => (at.value !== undefined && inRange(at.value) ? beadsAt(at.value) : undefined))
  const fewerBeads = drawnAt(fewerAt)
  const moreBeads = drawnAt(moreAt)

  /** A side's place follows the count at once; its beads are the last drawn until the ones at its count are. */
  function place(at: number | undefined, beads: Grid | undefined, step: -1 | 1): NeighbourPlace {
    const shownAt = count.value + step
    if (!inRange(shownAt)) return { end: true, count: shownAt }
    return { end: false, count: shownAt, beads, same: at === shownAt && !!beads && sameBeads(beads, beadsShown.value) }
  }

  return {
    fewer: computed(() => place(fewerAt.value, fewerBeads.value, -1)),
    more: computed(() => place(moreAt.value, moreBeads.value, 1)),
  }
}
