import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import { zoomFloorFor } from '../../domain/grid'

/** The screen tiers (responsive.md; the `bp-*` tokens, as literals since a script can't read them cheaply): each starts at its `from` width and reads its own `bead-min-*` token. Widest first. */
const TIERS = [
  { from: 1920, token: '--bead-min-desktop' },
  { from: 1280, token: '--bead-min-laptop' },
  { from: 1024, token: '--bead-min-tablet-lg' },
  { from: 744, token: '--bead-min-tablet' },
  { from: 0, token: '--bead-min-phone' },
] as const

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
  return computed(() => {
    const tier = TIERS.find((candidate) => width.value >= candidate.from) ?? TIERS[TIERS.length - 1]
    return zoomFloorFor(beadMinPx(tier.token, tier.from === 0 ? FALLBACK_PHONE_PX : FALLBACK_WIDER_PX))
  })
}
