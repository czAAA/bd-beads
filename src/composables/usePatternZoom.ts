import { computed, ref, watch } from 'vue'
import {
  CANVAS_MAX_PX,
  GRID_BORDER_PX,
  RULER_GUTTER_PX,
  ZOOM_STEP,
  clampZoom,
  computeFitZoom,
} from '../domain/grid'
import type { Pattern } from '../domain/pattern'

/** What's left of the canvas box for the grid itself, once the two ruler gutters and the grid's outline have had their share. */
const FIT_MAX_PX = CANVAS_MAX_PX - (RULER_GUTTER_PX + GRID_BORDER_PX) * 2

/**
 * The canvas zoom for whichever Pattern is open: it starts and resets at the level that fits the Pattern in the
 * canvas box, and steps in and out within the usable range. Lives outside PatternCanvas because the controls sit in
 * the above-canvas panel while the zoom applies to the canvas (ADR 0004, ticket 18).
 */
export function usePatternZoom(currentPattern: () => Pattern | undefined) {
  function fitZoom(): number {
    const pattern = currentPattern()
    if (!pattern) {
      return 1
    }

    return clampZoom(
      computeFitZoom({
        columns: pattern.columns,
        rows: pattern.rows,
        maxWidth: FIT_MAX_PX,
        maxHeight: FIT_MAX_PX,
        technique: pattern.technique,
      }),
    )
  }

  const zoom = ref(fitZoom())

  watch(() => currentPattern()?.id, () => {
    zoom.value = fitZoom()
  })

  return {
    zoom,
    zoomPercent: computed(() => Math.round(zoom.value * 100)),
    zoomIn: () => {
      zoom.value = clampZoom(zoom.value + ZOOM_STEP)
    },
    zoomOut: () => {
      zoom.value = clampZoom(zoom.value - ZOOM_STEP)
    },
    resetZoom: () => {
      zoom.value = fitZoom()
    },
  }
}
