import { computed, ref, shallowRef } from 'vue'
import {
  DEFAULT_MAX_IMAGE_COLORS,
  clampMaxImageColors,
  type PixelData,
} from '../../domain/imageConversion'
import {
  CENTERED_PAN,
  CONVERT_ZOOM_STEP,
  clampConvertZoom,
  type PanFraction,
} from '../../domain/imageFraming'

// The framing step of Convert image (ticket 58, ADR 0010): the picture and how it sits under the frame, independent of
// the open Project (it creates one). Cancel discards everything. It holds no frame: whether framing runs is App.vue's
// `framing` computed, the one gate for all framing UI.
export function useConvertImage() {
  /** shallowRef: a decoded picture is megabytes of pixels that are never mutated in place, so deep reactivity would
   * only slow every sampling read. */
  const image = shallowRef<PixelData | undefined>()
  /** A multiple of the scale at which the picture just covers the frame — 1 is that scale (see CONVERT_MIN_ZOOM). */
  const zoom = ref(1)
  /** How far the picture has been moved under the frame, as a fraction of how far it can go (see PanFraction). */
  const pan = ref<PanFraction>({ ...CENTERED_PAN })
  const maxColors = ref(DEFAULT_MAX_IMAGE_COLORS)

  function reset(): void {
    zoom.value = 1
    pan.value = { ...CENTERED_PAN }
    maxColors.value = DEFAULT_MAX_IMAGE_COLORS
  }

  return {
    image,
    zoom,
    pan,
    maxColors,
    zoomPercent: computed(() => Math.round(zoom.value * 100)),

    /** Starts framing a freshly decoded picture, from a clean slate whatever a previous attempt left behind. */
    start(decoded: PixelData): void {
      reset()
      image.value = decoded
    },

    /** Leaves framing, creating nothing and keeping nothing. */
    cancel(): void {
      image.value = undefined
      reset()
    },

    zoomIn(): void {
      zoom.value = clampConvertZoom(zoom.value + CONVERT_ZOOM_STEP)
    },
    zoomOut(): void {
      zoom.value = clampConvertZoom(zoom.value - CONVERT_ZOOM_STEP)
    },
    /** Back to the scale at which the picture just covers the frame, centred over it. */
    resetZoom(): void {
      zoom.value = 1
      pan.value = { ...CENTERED_PAN }
    },

    setPan(next: PanFraction): void {
      pan.value = next
    },
    setMaxColors(next: number): void {
      maxColors.value = clampMaxImageColors(next)
    },
  }
}
