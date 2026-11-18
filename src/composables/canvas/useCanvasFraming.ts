import { computed, ref } from 'vue'
import { cssZoomOf } from '../ui/cssZoom'
import type { Project } from '../../domain/project'
import { NO_INSETS, pillInsets, type Insets, type PillPosition, type PillRect } from '../../domain/toolPill'
import type { Size } from '../../rendering/cellSize'
import type { Region } from '../../rendering/surfaceView'
import { useElementSize } from '../ui/useElementSize'
import { useCanvasView, type CanvasViewOptions } from './useCanvasView'

/** What the canvas view needs from the app shell: the open Project. */
export interface CanvasFramingDeps {
  currentProject: () => Project | undefined
  /** Saves the Canvas's orientation a two-finger twist settled on (ticket 0672). */
  keepTwist?: (orientation: number) => void
  /** The view a Project opens at this once, in place of its fit (ticket 0879). */
  opening?: CanvasViewOptions['opening']
}

/** How the canvas is sized and zoomed (tickets 27, 57, 197; ADR 0020): the measured area, fit zoom and the strip's
 * meta. */
export function useCanvasFraming(deps: CanvasFramingDeps) {
  /** The canvas area's own element, measured live (ticket 27) so the Project's fit zoom tracks the real available
   * space instead of a guessed constant. */
  const canvasAreaEl = ref<HTMLElement | null>(null)
  const { width, height } = useElementSize(canvasAreaEl)
  const viewport = computed(() => ({ width: width.value, height: height.value }))
  /** What the Tool pill takes from the edge it docks to (ticket 0850), kept while it is away (the Adjust bar's turn). */
  const toolPillCover = ref<Insets>(NO_INSETS)

  const { zoom, scroll, placed, zoomIn, zoomOut, setZoom, resetZoom, panBy, scrollBy, centreOn, bringIntoView, putBack, visibleCentre, canvasOnScreen, isAtFit, orientation, twistPhase, pinchStep, endTwist } = useCanvasView(deps.currentProject, viewport, { keepTwist: deps.keepTwist, covered: () => toolPillCover.value, opening: deps.opening })

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

  /** The drawing area's box on the screen (ticket 0971), or none until it is laid out. */
  function areaOnScreen(): Region | undefined {
    const box = canvasAreaEl.value?.getBoundingClientRect()
    return box && box.width > 0 && box.height > 0 ? { x: box.left, y: box.top, width: box.width, height: box.height } : undefined
  }

  /** The CSS zoom the drawing area is drawn at (ticket 1071): 1 in the editor, more in the Homepage's grown demo. */
  function areaZoom(): number {
    return cssZoomOf(canvasAreaEl.value)
  }

  /** The Tool pill measured in the drawing area (`area`, its size at that moment) and the edge it docks to: a Fit leaves
   * the room it takes clear (ticket 0850). */
  function onToolPillPlaced(rect: PillRect | undefined, area: Size, position: PillPosition) {
    if (rect) toolPillCover.value = pillInsets(rect, area, position)
  }

  return {
    bindCanvasArea,
    canvasViewport: viewport,
    zoom,
    scroll,
    /** Whether the view has had its first fit (ticket 0991). */
    viewPlaced: placed,
    zoomIn,
    zoomOut,
    setZoom,
    resetZoom,
    panBy,
    scrollBy,
    centreOn,
    /** Pans the shortest way that brings a part of the drawing into view, zoom untouched (ticket 0934). */
    bringIntoView,
    /** Takes back a move `bringIntoView` made, unless the view was moved since (ticket 0971). */
    putBack,
    areaOnScreen,
    areaZoom,
    visibleCentre,
    canvasOnScreen,
    /** Whether the view still follows the fit, not a place the person moved it to. */
    isAtFit,
    orientation,
    twistPhase,
    pinchStep,
    endTwist,
    zoomPercent,
    stripZoomPercent,
    onToolPillPlaced,
  }
}
