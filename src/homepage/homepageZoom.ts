import { onBeforeUnmount, onMounted, ref, readonly, type Ref } from 'vue'
import { stepZoom } from '../domain/grid'

/** The Homepage's zoom range in percent (ticket 540, ADR 0073): the page's content, not the Project canvas. */
export const HOMEPAGE_MIN_ZOOM_PERCENT = 75
export const HOMEPAGE_MAX_ZOOM_PERCENT = 200
const FIT_PERCENT = 100
const STORAGE_KEY = 'openbeads:homepage-zoom'

function clampPercent(percent: number): number {
  return Math.min(HOMEPAGE_MAX_ZOOM_PERCENT, Math.max(HOMEPAGE_MIN_ZOOM_PERCENT, Math.round(percent)))
}

/** What this device last chose, or Fit when nothing readable is stored. */
function loadPercent(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(stored) && stored > 0 ? clampPercent(stored) : FIT_PERCENT
  } catch {
    return FIT_PERCENT
  }
}

function savePercent(percent: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(percent))
  } catch {
    // Nowhere to remember it: the zoom lasts until the page closes.
  }
}

/** The Homepage's zoom in whole percents, stepped by the editor's 10% rungs, remembered on this device; Fit is 100%. */
export function useHomepageZoom(): {
  percent: Readonly<Ref<number>>
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
} {
  const percent = ref(loadPercent())
  function set(next: number) {
    percent.value = clampPercent(next)
    savePercent(percent.value)
  }
  return {
    percent: readonly(percent),
    zoomIn: () => set(stepZoom(percent.value / 100, 1) * 100),
    zoomOut: () => set(stepZoom(percent.value / 100, -1) * 100),
    reset: () => set(FIT_PERCENT),
  }
}

/** The screen the Homepage's layout is made to fit whole (ticket 1059): a 13–14" laptop's. */
const FIT_SCREEN = { width: 1440, height: 900 }
/** The most a large screen grows the box and its sections (ticket 1059): a third. */
const MOST_SCALE = 4 / 3

/** How much a screen larger than 1440 × 900 grows the Homepage's box and sections (ticket 1059): the smaller of its
 * width and height against that screen's, never under 1 and never over a third more. The zoom's Fit is this size.
 * @internal Exported for the test of the rule, which tries screens no browser test opens. */
export function homepageScale(width: number, height: number): number {
  const scale = Math.min(width / FIT_SCREEN.width, height / FIT_SCREEN.height)
  return Number.isFinite(scale) ? Math.min(MOST_SCALE, Math.max(1, scale)) : 1
}

/** The Homepage's scale for the window it is in, regrown at once as the window is resized (ticket 1059). */
export function useHomepageScale(): Readonly<Ref<number>> {
  const measure = () => homepageScale(window.innerWidth, window.innerHeight)
  const scale = ref(measure())
  const onResize = () => (scale.value = measure())
  onMounted(() => window.addEventListener('resize', onResize))
  onBeforeUnmount(() => window.removeEventListener('resize', onResize))
  return readonly(scale)
}
