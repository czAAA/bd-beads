import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Grid } from '../../domain/project'
import { NEIGHBOURS_REST_MS, sameBeads } from './useConvertNeighbours'

/** What the reach reads from the wizard: the count asked, the colors the beads use, the beads at another count, and the
 * beads shown now. */
export interface ConvertColorsReachDeps {
  count: Ref<number>
  found: Ref<number>
  beadsAt: (count: number) => Grid
  beadsShown: Ref<Grid>
}


/** The last count that changes the beads (ConvertImage card, ticket 0928): with fewer colors found than asked, the least
 * count whose beads are those shown, none otherwise. Found once the count rests, one count per task, by halving between
 * the colors found and the count asked; the last reach is kept while the next is worked out. */
export function useConvertColorsReach({ count, found, beadsAt, beadsShown }: ConvertColorsReachDeps): Readonly<Ref<number | undefined>> {
  const reach = ref<number>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => clearTimeout(timer)

  function step(low: number, high: number, shown: Grid) {
    if (low >= high) {
      reach.value = high
      return
    }
    const middle = Math.floor((low + high) / 2)
    const [nextLow, nextHigh] = sameBeads(beadsAt(middle), shown) ? [low, middle] : [middle + 1, high]
    timer = setTimeout(() => step(nextLow, nextHigh, shown))
  }

  watch(
    [count, found, beadsShown],
    ([asked, used, shown]) => {
      stop()
      if (used >= asked) {
        reach.value = undefined
        return
      }
      timer = setTimeout(() => step(Math.max(1, used), asked, shown), NEIGHBOURS_REST_MS)
    },
    { immediate: true },
  )
  onScopeDispose(stop)

  return reach
}
