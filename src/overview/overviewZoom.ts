import { ref, readonly, type Ref } from 'vue'
import { stepZoom } from '../domain/grid'

/** The Overview's zoom range in percent (ticket 540, ADR 0073): the page's content, not the Project canvas. */
export const OVERVIEW_MIN_ZOOM_PERCENT = 75
export const OVERVIEW_MAX_ZOOM_PERCENT = 200
const FIT_PERCENT = 100
const STORAGE_KEY = 'openbeads:overview-zoom'

function clampPercent(percent: number): number {
  return Math.min(OVERVIEW_MAX_ZOOM_PERCENT, Math.max(OVERVIEW_MIN_ZOOM_PERCENT, Math.round(percent)))
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

/** The Overview's zoom in whole percents, stepped by the editor's 10% rungs, remembered on this device; Fit is 100%. */
export function useOverviewZoom(): {
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
