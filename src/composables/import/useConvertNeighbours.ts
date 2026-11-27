import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import type { Grid } from '../../domain/project'
import { MIN_IMAGE_COLORS } from '../../domain/imageConversion'

/** What the neighbours read from the wizard: the count shown and the most there can be, whether the card is on screen,
 * the colors the beads use, the beads at another count (worked out off the main thread, ticket 1253), and the beads
 * shown now. */
export interface ConvertNeighboursDeps {
  count: Ref<number>
  most: Ref<number>
  shown: Ref<boolean>
  found: Ref<number>
  beadsAt: (count: number) => Promise<Grid>
  beadsShown: Ref<Grid>
}

/** One side's place: the end of the range, or its count with the beads last drawn there (none until the first are), and
 * whether they are the beads at that count and the same as those shown, so taking it would change nothing. */
export type NeighbourPlace = { end: true; count: number } | { end: false; count: number; beads: Grid | undefined; same: boolean }

/** How long the count rests before the neighbours follow it (DS-2: about 150 ms). @internal The tests wait it out. */
export const NEIGHBOURS_REST_MS = 150
/** The most colors the card draws its neighbours at (ticket 1253, the Colors slider's last mark): past it one color more
 * or fewer looks the same, so the card holds the typed number only. @internal The tests count to it. */
export const NEIGHBOUR_PREVIEWS_UP_TO = 20

/** Whether two grids hold the same beads, place by place. */
export function sameBeads(a: Grid, b: Grid): boolean {
  return a.length === b.length && a.every((row, at) => row.length === b[at]!.length && row.every((cell, column) => cell.color === b[at]![column]!.color))
}

type Drawn = { at: number; beads: Grid } | undefined

/** The Colors neighbours (ConvertImage card DS-2, ticket 0904): the beads at one color fewer and one more, the page's own
 * conversion, following the count and the beads shown once they rest, each kept until the next is drawn; only while the
 * card shows and draws them (`previews`: up to 20 colors, as many found as asked, ticket 1253). */
export function useConvertNeighbours({ count, most, shown, found, beadsAt, beadsShown }: ConvertNeighboursDeps) {
  const fewerDrawn = shallowRef<Drawn>()
  const moreDrawn = shallowRef<Drawn>()
  const previews = computed(() => count.value <= NEIGHBOUR_PREVIEWS_UP_TO && found.value >= count.value)
  let timer: ReturnType<typeof setTimeout> | undefined
  let run = 0
  const stop = () => {
    clearTimeout(timer)
    run += 1
  }

  const inRange = (at: number) => at >= MIN_IMAGE_COLORS && at <= most.value

  async function draw(now: number, mine: number) {
    for (const [at, side] of [[now - 1, fewerDrawn], [now + 1, moreDrawn]] as const) {
      if (!inRange(at)) continue
      const beads = await beadsAt(at)
      if (mine !== run) return
      side.value = { at, beads }
    }
  }

  watch(
    [shown, previews, count, beadsShown],
    ([on, drawing, now]) => {
      stop()
      if (!on) {
        // Hidden, the drawn ones go: the settings may change before the card shows again.
        fewerDrawn.value = moreDrawn.value = undefined
        return
      }
      if (!drawing) return
      const mine = run
      timer = setTimeout(() => void draw(now, mine), NEIGHBOURS_REST_MS)
    },
    { immediate: true },
  )
  onScopeDispose(stop)

  /** A side's place follows the count at once; its beads are the last drawn until the ones at its count are. */
  function place(drawn: Drawn, step: -1 | 1): NeighbourPlace {
    const shownAt = count.value + step
    if (!inRange(shownAt)) return { end: true, count: shownAt }
    const beads = drawn && inRange(drawn.at) ? drawn.beads : undefined
    return { end: false, count: shownAt, beads, same: drawn?.at === shownAt && !!beads && sameBeads(beads, beadsShown.value) }
  }

  return {
    previews,
    fewer: computed(() => place(fewerDrawn.value, -1)),
    more: computed(() => place(moreDrawn.value, 1)),
  }
}
