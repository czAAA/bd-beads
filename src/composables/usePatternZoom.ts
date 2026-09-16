import { computed, ref, watch, type Ref } from 'vue'
import { CANVAS_MAX_PX, GRID_BORDER_PX, RULER_GUTTER_PX, ZOOM_STEP, clampZoom, computeFitZoom } from '../domain/grid'
import type { Pattern } from '../domain/pattern'

/** What's left for the grid itself, given an outer size, once the two ruler gutters and the grid's outline have had their share. */
function fitMaxPx(outerPx: number): number {
  return outerPx - (RULER_GUTTER_PX + GRID_BORDER_PX) * 2
}

/**
 * The canvas zoom for whichever Pattern is open: it starts and resets at the level that fits the Pattern in the
 * canvas area, and steps in and out within the usable range. Lives outside PatternCanvas because the controls sit in
 * the above-canvas panel while the zoom applies to the canvas (ADR 0004, ticket 18).
 *
 * availableWidth is the canvas area's live measured width (ticket 27's useElementSize, backed by ResizeObserver)
 * rather than a fixed constant, so the fit level tracks whatever room the real window actually has instead of a
 * guessed box size. Before the first measurement lands (briefly, on mount — see useElementSize) it reads 0;
 * CANVAS_MAX_PX stands in for the unmeasured case so the Pattern doesn't flash in at a degenerate near-zero zoom,
 * and the fit re-runs (see the watch below) as soon as the real size arrives.
 *
 * Height deliberately isn't part of this fit: the canvas box has no height cap of its own (see the "never trapped"
 * comment on .app-shell__canvas in App.vue) and grows to whatever the Pattern needs, with the page scrolling past
 * it. Measuring the box's own rendered height and feeding it back into the zoom that produced that height is
 * circular — it would ratchet the zoom down every resize tick until it bottomed out at MIN_ZOOM instead of settling
 * at 100% for an ordinary Pattern (ticket 27 shipped that bug unnoticed since it went untested in a real browser).
 */
export function usePatternZoom(
  currentPattern: () => Pattern | undefined,
  availableWidth: Ref<number>,
) {
  function fitZoom(): number {
    const pattern = currentPattern()
    if (!pattern) {
      return 1
    }

    // columns/rows/technique stay the Pattern's real (unrotated) geometry — only which on-screen dimension the
    // available width constrains swaps, since a rotated Pattern's natural height becomes its visual width.
    const available = fitMaxPx(availableWidth.value || CANVAS_MAX_PX)

    return clampZoom(
      computeFitZoom({
        columns: pattern.columns,
        rows: pattern.rows,
        maxWidth: pattern.rotated ? Infinity : available,
        maxHeight: pattern.rotated ? available : Infinity,
        technique: pattern.technique,
      }),
    )
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

  watch(availableWidth, () => {
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
    resetZoom: () => {
      zoom.value = fitZoom()
      isAtFit.value = true
    },
  }
}
