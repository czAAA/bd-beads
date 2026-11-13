import { computed, ref, shallowRef, type Ref } from 'vue'
import { clamp } from '../../domain/clamp'
import type { PixelData } from '../../domain/imageConversion'
import {
  LIGHTING_SLIDER_LEAST,
  LIGHTING_SLIDER_MOST,
  litPicture,
  measureLighting,
  SLIDERS_AT_REST,
  slidersAtRest,
  type LightingSlider,
  type LightingSliders,
} from '../../domain/lightingFix'

/** Auto-fix lighting (DS-3, ticket 0907, decision D-2), the picture section's switch that corrects the picture before it
 * becomes beads, and behind it Brightness, Contrast and Saturation (ticket 0908), set by hand after it. Off and at 0 for
 * every picture and not remembered (`reset`), so flat art's colors are never changed behind anyone's back. */
export function useConvertLighting(image: Ref<PixelData | undefined>) {
  const on = ref(false)
  const sliders = shallowRef<LightingSliders>(SLIDERS_AT_REST)
  /** Auto-fix lighting as measured from the picture, once per picture, while the switch is on. */
  const fix = computed(() => (on.value && image.value ? measureLighting(image.value) : undefined))
  /** The picture the beads are sampled from: lit and adjusted, or the picture itself while nothing changes it. */
  const picture = computed(() => {
    const original = image.value
    if (!original || (!fix.value && slidersAtRest(sliders.value))) return original
    return litPicture(original, fix.value, sliders.value)
  })
  /** A slider set to a whole number within its ends. */
  function setSlider(name: LightingSlider, value: number) {
    const kept = Math.round(clamp(value, LIGHTING_SLIDER_LEAST, LIGHTING_SLIDER_MOST))
    if (kept !== sliders.value[name]) sliders.value = { ...sliders.value, [name]: kept }
  }
  return {
    on,
    setOn: (next: boolean) => (on.value = next),
    sliders,
    setSlider,
    /** A slider's reset: back to 0, the others as they are. */
    resetSlider: (name: LightingSlider) => setSlider(name, 0),
    /** A new picture opens with the switch off and the sliders at 0. */
    reset: () => {
      on.value = false
      sliders.value = SLIDERS_AT_REST
    },
    picture,
  }
}
