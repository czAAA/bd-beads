import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Grid } from '../../domain/project'
import { NEIGHBOURS_REST_MS, sameBeads } from './useConvertNeighbours'

/** What the reach reads from the wizard: the count asked, the colors the beads use, the beads at another count (worked
 * out off the main thread, ticket 1253), and the beads shown now. */
export interface ConvertColorsReachDeps {
  count: Ref<number>
  found: Ref<number>
  beadsAt: (count: number) => Promise<Grid>
  beadsShown: Ref<Grid>
}

/** The last count that changes the beads (ConvertImage card, ticket 0928): with fewer colors found than asked, the least
 * count whose beads are those shown, else none. Found once the count rests, halving between the colors found and the count
 * asked; the last reach is kept while the next is worked out, and a search the count moved away from is dropped. */
export function useConvertColorsReach({ count, found, beadsAt, beadsShown }: ConvertColorsReachDeps): Readonly<Ref<number | undefined>> {
  const reach = ref<number>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let search = 0
  const stop = () => {
    clearTimeout(timer)
    search += 1
  }

  async function find(low: number, high: number, shown: Grid, mine: number) {
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      const beads = await beadsAt(middle)
      if (mine !== search) return
      if (sameBeads(beads, shown)) high = middle
      else low = middle + 1
    }
    reach.value = high
  }

  watch(
    [count, found, beadsShown],
    ([asked, used, shown]) => {
      stop()
      if (used >= asked) {
        reach.value = undefined
        return
      }
      const mine = search
      timer = setTimeout(() => void find(Math.max(1, used), asked, shown, mine), NEIGHBOURS_REST_MS)
    },
    { immediate: true },
  )
  onScopeDispose(stop)

  return reach
}
