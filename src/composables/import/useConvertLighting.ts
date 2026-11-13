import { computed, ref, type Ref } from 'vue'
import type { PixelData } from '../../domain/imageConversion'
import { litPicture, measureLighting } from '../../domain/lightingFix'

/** Auto-fix lighting (ConvertImage card DS-3, ticket 0907, decision D-2): one switch in the picture section that
 * corrects the picture before it becomes beads. Off for every picture, never on by itself and not remembered: a new
 * picture opens with it off (`reset`), so flat art's colors are never changed behind anyone's back. */
export function useConvertLighting(image: Ref<PixelData | undefined>) {
  const on = ref(false)
  /** The picture the beads are sampled from: the lit one while the switch is on, else the picture itself. */
  const picture = computed(() => {
    const original = image.value
    return on.value && original ? litPicture(original, measureLighting(original)) : original
  })
  return {
    on,
    setOn: (next: boolean) => (on.value = next),
    /** A new picture opens with it off. */
    reset: () => (on.value = false),
    picture,
  }
}
