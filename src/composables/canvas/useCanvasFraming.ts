import { computed, ref } from 'vue'
import type { Pattern } from '../../domain/pattern'
import { useElementSize } from '../ui/useElementSize'
import { useCanvasView } from './useCanvasView'
import { useZoomFloor } from './useZoomFloor'

/** What the canvas strip needs to know about the framing step: whether it is running, and the grid it frames. */
export interface CanvasFramingDeps {
  currentPattern: () => Pattern | undefined
  framing: () => { dimensions: { columns: number; rows: number } } | undefined
  convertZoomPercent: () => number
}

/**
 * How the canvas is sized and zoomed (tickets 27, 57, 197; ADR 0023): the drawing area's measured size feeding the
 * Pattern's fit zoom, the zoom readout, and the strip's size and zoom meta, which follow the framing step while it
 * runs and the open Pattern otherwise. Deps are read lazily.
 */
export function useCanvasFraming(deps: CanvasFramingDeps) {
  /** The canvas area's own element, measured live (ticket 27) so the Pattern's fit zoom tracks the real available space instead of a guessed constant. */
  const canvasAreaEl = ref<HTMLElement | null>(null)
  const { width, height } = useElementSize(canvasAreaEl)
  const viewport = computed(() => ({ width: width.value, height: height.value }))

  const { zoom, scroll, zoomIn, zoomOut, setZoom, resetZoom, panBy, scrollBy, centreOn, reveal } = useCanvasView(deps.currentPattern, viewport, useZoomFloor())

  /** The floating zoom cluster's own readout (ticket 57): derived from the same zoom the grid scales by, rather than threaded down as a second prop. */
  const zoomPercent = computed(() => Math.round(zoom.value * 100))

  /** The canvas strip's size meta while a picture is being framed: the Pattern it will make. Otherwise the strip describes the open Pattern itself. */
  const stripSize = computed(() => deps.framing()?.dimensions)

  /** The strip's zoom level: framing's own while framing, the Pattern's otherwise, none with nothing on the board. */
  const stripZoomPercent = computed(() =>
    deps.framing() ? deps.convertZoomPercent() : deps.currentPattern() ? zoomPercent.value : undefined,
  )

  /** A template function ref for the canvas area, so the element stays this composable's own rather than a name App.vue has to declare. */
  function bindCanvasArea(el: unknown) {
    canvasAreaEl.value = el instanceof HTMLElement ? el : null
  }

  return {
    bindCanvasArea,
    canvasAreaWidth: width,
    canvasViewport: viewport,
    zoom,
    scroll,
    zoomIn,
    zoomOut,
    setZoom,
    resetZoom,
    panBy,
    scrollBy,
    centreOn,
    reveal,
    zoomPercent,
    stripSize,
    stripZoomPercent,
  }
}
