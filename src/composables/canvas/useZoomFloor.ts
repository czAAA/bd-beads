import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import { PHONE_MAX_WIDTH_PX, zoomFloorFor } from '../../domain/grid'

/** Fallbacks for when the page carries no tokens (tests): the `bead-min-*` values in tokens.json. */
const FALLBACK_PHONE_PX = 16
const FALLBACK_WIDER_PX = 15

/** A `bead-min-*` token (rem or px) read from the page, in px, so the floor follows tokens.json rather than a copy of its numbers. */
function beadMinPx(token: string, fallback: number): number {
  const root = document.documentElement
  const value = getComputedStyle(root).getPropertyValue(token).trim()
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number)) {
    return fallback
  }
  return value.endsWith('rem') ? number * (Number.parseFloat(getComputedStyle(root).fontSize) || 16) : number
}

/**
 * The zoom-out floor for the current window (ticket 223): the smallest bead of its tier, so every ruler number stays
 * clear. It follows the window width, so a resize or a rotated phone moves it. `viewportWidth` is only for tests.
 */
export function useZoomFloor(viewportWidth?: Ref<number>): Ref<number> {
  const width = viewportWidth ?? ref(window.innerWidth)
  if (!viewportWidth) {
    const onResize = () => (width.value = window.innerWidth)
    window.addEventListener('resize', onResize)
    onBeforeUnmount(() => window.removeEventListener('resize', onResize))
  }
  return computed(() =>
    zoomFloorFor(
      width.value <= PHONE_MAX_WIDTH_PX
        ? beadMinPx('--bead-min-phone', FALLBACK_PHONE_PX)
        : beadMinPx('--bead-min-tablet', FALLBACK_WIDER_PX),
    ),
  )
}
