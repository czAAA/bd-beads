import { computed, ref } from 'vue'
import type { Project } from '../../domain/project'
import { useElementSize } from '../ui/useElementSize'
import { useCanvasView } from './useCanvasView'

/** What the canvas view needs from the app shell: the open Project. */
export interface CanvasFramingDeps {
  currentProject: () => Project | undefined
  /** Saves the Canvas's orientation a two-finger twist settled on (ticket 0672). */
  keepTwist?: (orientation: number) => void
}

/** How the canvas is sized and zoomed (tickets 27, 57, 197; ADR 0020): the measured area, fit zoom and the strip's
 * meta. */
export function useCanvasFraming(deps: CanvasFramingDeps) {
  /** The canvas area's own element, measured live (ticket 27) so the Project's fit zoom tracks the real available
   * space instead of a guessed constant. */
  const canvasAreaEl = ref<HTMLElement | null>(null)
  const { width, height } = useElementSize(canvasAreaEl)
  const viewport = computed(() => ({ width: width.value, height: height.value }))

  const { zoom, scroll, zoomIn, zoomOut, setZoom, resetZoom, panBy, scrollBy, centreOn, visibleCentre, orientation, twistBy, endTwist } = useCanvasView(deps.currentProject, viewport, { keepTwist: deps.keepTwist })

  /** The floating zoom cluster's own readout (ticket 57): derived from the same zoom the grid scales by, rather than
   * threaded down as a second prop. */
  const zoomPercent = computed(() => Math.round(zoom.value * 100))

  /** The strip's zoom level: the Project's, none with nothing on the board. */
  const stripZoomPercent = computed(() => (deps.currentProject() ? zoomPercent.value : undefined))

  /** A template function ref for the canvas area, so the element stays this composable's own rather than a name
   * App.vue has to declare. */
  function bindCanvasArea(el: unknown) {
    canvasAreaEl.value = el instanceof HTMLElement ? el : null
  }

  return {
    bindCanvasArea,
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
    visibleCentre,
    orientation,
    twistBy,
    endTwist,
    zoomPercent,
    stripZoomPercent,
  }
}
