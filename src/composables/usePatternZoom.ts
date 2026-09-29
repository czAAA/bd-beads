import { computed, ref, watch, type Ref } from 'vue'
import { CANVAS_MAX_PX, GRID_BORDER_PX, RULER_GUTTER_PX, ZOOM_STEP, clampZoom, rotationSwapsAxes } from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import { patternExtentPx } from '../rendering/patternRenderer'

/**
 * Room left free around the ruled Pattern at the fit level (CanvasStrip and BeadBoard cards: the board fills the
 * drawing area with about 36px spare left and right, 18px top and bottom).
 */
export const FIT_SPARE_X_PX = 36
export const FIT_SPARE_Y_PX = 18

/**
 * The largest zoom at which a Pattern of this drawn extent, with its rulers and board padding, fits an outer size.
 * The rulers keep their size at every zoom; the board's padding scales with the beads.
 */
function fitAlong(outerPx: number, spare: number, extentPx: number): number {
  return (outerPx - spare * 2 - RULER_GUTTER_PX * 2) / (extentPx + GRID_BORDER_PX * 2)
}

/**
 * The canvas zoom for whichever Pattern is open: it starts and resets at the level that fits the Pattern in the
 * drawing area, and steps in and out within the usable range. Lives outside PatternCanvas because the fit level
 * depends on the drawing area's own measured size, which is App.vue's to measure.
 *
 * availableWidth and availableHeight are the drawing area's live measured size (useElementSize, backed by
 * ResizeObserver), so the fit tracks whatever room the window has. Before the first measurement lands they read 0;
 * CANVAS_MAX_PX stands in for an unmeasured width, and an unmeasured height doesn't constrain, so the Pattern doesn't
 * flash in at a degenerate zoom, and the fit re-runs as soon as the real size arrives.
 *
 * Measuring height is safe since ticket 141: the drawing area is a fixed share of a canvas box that fills the screen,
 * and the Pattern scrolls inside it, so its height doesn't depend on the zoom that it feeds (before, the box grew
 * with the Pattern, and feeding its height back in ratcheted the zoom down every resize tick: ticket 27).
 */
export function usePatternZoom(
  currentPattern: () => Pattern | undefined,
  availableWidth: Ref<number>,
  availableHeight: Ref<number> = ref(0),
) {
  function fitZoom(): number {
    const pattern = currentPattern()
    if (!pattern) {
      return 1
    }

    // The drawn extent (the Pattern renderer's), not the layout maths': brick stitch's rows are a seam further apart.
    // columns/rows/technique stay the Pattern's real (unrotated) geometry; a rotated Pattern's height is drawn across.
    const extent = patternExtentPx(pattern.technique, pattern.columns, pattern.rows)
    const swapped = rotationSwapsAxes(pattern.rotation)
    const across = swapped ? extent.height : extent.width
    const down = swapped ? extent.width : extent.height

    const byWidth = fitAlong(availableWidth.value || CANVAS_MAX_PX, FIT_SPARE_X_PX, across)
    const byHeight = availableHeight.value > 0 ? fitAlong(availableHeight.value, FIT_SPARE_Y_PX, down) : Infinity
    return clampZoom(Math.floor(Math.min(1, byWidth, byHeight) * 100) / 100)
  }

  const zoom = ref(fitZoom())
  /**
   * Whether `zoom` still tracks the fit level rather than a level the user chose with +/-: while true, the canvas
   * area resizing (a browser window resize, a panel changing width) keeps the Pattern fit to it; zoomIn/zoomOut
   * turn this off so a resize doesn't yank a deliberate zoom choice out from under the user mid-edit, until they
   * hit Reset or open a different Pattern.
   */
  const isAtFit = ref(true)

  watch(() => currentPattern()?.id, () => {
    zoom.value = fitZoom()
    isAtFit.value = true
  })

  // A Resize (or its Undo) changes how big the Pattern is, so the fit level moves with it — unless a zoom was chosen by hand.
  watch(() => [currentPattern()?.columns, currentPattern()?.rows], () => {
    if (isAtFit.value) {
      zoom.value = fitZoom()
    }
  })

  watch([availableWidth, availableHeight], () => {
    if (isAtFit.value) {
      zoom.value = fitZoom()
    }
  })

  return {
    zoom,
    zoomPercent: computed(() => Math.round(zoom.value * 100)),
    zoomIn: () => {
      zoom.value = clampZoom(zoom.value + ZOOM_STEP)
      isAtFit.value = false
    },
    zoomOut: () => {
      zoom.value = clampZoom(zoom.value - ZOOM_STEP)
      isAtFit.value = false
    },
    /** A zoom the fingers chose (pinch): any level in the usable range rather than a step, and a choice a resize leaves alone. */
    setZoom: (value: number) => {
      zoom.value = clampZoom(value)
      isAtFit.value = false
    },
    resetZoom: () => {
      zoom.value = fitZoom()
      isAtFit.value = true
    },
  }
}
