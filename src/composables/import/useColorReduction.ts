import { onScopeDispose, ref, shallowRef, toRaw, watch, type Ref } from 'vue'
import type { ReductionRequest } from '../../domain/convertColors'
import type { ReducedColors } from '../../domain/imageColors'
import { createColorReducer, type ColorReducer } from '../../services/colorReducer'

const NOTHING: ReducedColors = { colors: [], byHex: new Map(), keptApart: false }

/** A picture's color reduction that follows `request` without freezing the page (ticket 1163): `reduced` keeps the last
 * result while a newer one is made, only the latest request's result ever lands, and `reducing` says one is running.
 * Where there is no worker the reduction runs at once, so `reduced` is current as soon as `request` changes. */
export function useColorReduction(request: () => ReductionRequest, reducer: ColorReducer = createColorReducer()) {
  const reduced = shallowRef<ReducedColors>(NOTHING)
  const reducing: Ref<boolean> = ref(false)
  let latest = 0

  watch(
    request,
    (asked) => {
      const mine = ++latest
      reducing.value = true
      reducer.reduce({ ...asked, targets: toRaw(asked.targets), choices: toRaw(asked.choices), counts: toRaw(asked.counts) }, (result) => {
        if (mine !== latest) return
        reduced.value = result
        reducing.value = false
      })
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => reducer.stop())

  return { reduced, reducing }
}
