import { computed, ref, shallowRef } from 'vue'
import {
  DEFAULT_MAX_IMAGE_COLORS,
  clampMaxImageColors,
  type PixelData,
} from '../domain/imageConversion'
import {
  CENTERED_PAN,
  CONVERT_ZOOM_STEP,
  clampConvertZoom,
  type PanFraction,
} from '../domain/imageFraming'

/**
 * The framing step of Convert image (ticket 58, ADR 0010): which picture is being framed, and how it sits under the
 * frame. Deliberately independent of which Pattern is open — conversion creates a Pattern, it never converts into one
 * (ADR 0010), so this answers to nothing in the editor and the editor answers to nothing here.
 *
 * Nothing survives leaving: Cancel discards the picture along with the zoom, the pan and the colour count (ticket 58
 * decision), so re-entering always starts from a clean slate. There is deliberately nowhere to remember a picture for
 * a second try at different settings.
 *
 * Holds the picture and nothing about the frame. Whether framing is actually *running* is a question only App.vue can
 * answer, since it also needs the frame the New Pattern form's fields imply — see its `framing` computed, the one gate
 * for every piece of framing UI.
 */
export function useConvertImage() {
  /**
   * shallowRef, not ref: a decoded picture is megabytes of pixel bytes, and a deep ref would wrap that array in a
   * reactive proxy — every one of the tens of thousands of channel reads a single sampling pass makes would then go
   * through it. Nothing ever mutates a decoded picture in place, so there is nothing deep reactivity would buy.
   */
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
