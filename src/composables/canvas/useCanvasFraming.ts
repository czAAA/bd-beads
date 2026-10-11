import { computed, ref } from 'vue'
import type { Project } from '../../domain/project'
import { useElementSize } from '../ui/useElementSize'
import { useCanvasView } from './useCanvasView'

/** What the canvas strip needs to know about the framing step: whether it is running, and the grid it frames. */
export interface CanvasFramingDeps {
  currentProject: () => Project | undefined
  framing: () => { dimensions: { columns: number; rows: number } } | undefined
  convertZoomPercent: () => number
}

/**
 * How the canvas is sized and zoomed (tickets 27, 57, 197; ADR 0020): the drawing area's measured size feeding the
 * Project's fit zoom, the zoom readout, and the strip's size and zoom meta, which follow the framing step while it
 * runs and the open Project otherwise. Deps are read lazily.
 */
export function useCanvasFraming(deps: CanvasFramingDeps) {
  /** The canvas area's own element, measured live (ticket 27) so the Project's fit zoom tracks the real available space instead of a guessed constant. */
  const canvasAreaEl = ref<HTMLElement | null>(null)
  const { width, height } = useElementSize(canvasAreaEl)
  const viewport = computed(() => ({ width: width.value, height: height.value }))

  const { zoom, scroll, zoomIn, zoomOut, setZoom, resetZoom, panBy, scrollBy, centreOn, reveal } = useCanvasView(deps.currentProject, viewport)

  /** The floating zoom cluster's own readout (ticket 57): derived from the same zoom the grid scales by, rather than threaded down as a second prop. */
  const zoomPercent = computed(() => Math.round(zoom.value * 100))

  /** The canvas strip's size meta while a picture is being framed: the Project it will make. Otherwise the strip describes the open Project itself. */
  const stripSize = computed(() => deps.framing()?.dimensions)

  /** The strip's zoom level: framing's own while framing, the Project's otherwise, none with nothing on the board. */
  const stripZoomPercent = computed(() =>
    deps.framing() ? deps.convertZoomPercent() : deps.currentProject() ? zoomPercent.value : undefined,
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
