import { computed, ref, watch, type Ref } from 'vue'
import { beadBounds, type Rect, sameFrame } from '../../domain/canvas'
import { clampZoom, stepZoom, type GridPosition } from '../../domain/grid'
import { projectCell } from '../../domain/projectBead'
import type { Project } from '../../domain/project'
import { DEFAULT_TECHNIQUE } from '../../domain/weave'
import { OPEN_SPACE } from '../../rendering/space'
import { surfaceView, type Scroll, type SurfaceView, type ViewLayer } from '../../rendering/surfaceView'
import type { Size } from '../../rendering/cellSize'

/** Room left clear round the Project at the fit level: the ruler gutter (28px) and a little air (CanvasStrip and
 * BeadBoard cards).
 * @internal Its test works out the fit zoom with it. */
export const FIT_MARGIN_PX: Size = { width: 64, height: 46 }

/** The block of beads a view fits to and centres on: the Frame when there is one, otherwise the box round every
 * bead, otherwise nothing.
 * @internal Its test checks what a view fits to on its own. */
export function fitBox(project: Pick<Project, 'frame' | 'beads'>): Rect | undefined {
  return project.frame ?? beadBounds(project.beads)
}

/** The layer a block is measured in: the Frame's own for the Frame itself (ticket 492), the Canvas's for anything else. */
function layerOfBox(project: Pick<Project, 'frame'>, box: Rect): ViewLayer {
  return project.frame && sameFrame(box, project.frame) ? 'frame' : 'canvas'
}

// Where the Canvas is looked at from (ADR 0026): zoom and scroll over an endless field. `fit` shows the Frame (or all
// drawn) whole; until moved by hand the view follows it, after that it keeps the chosen part, and a zoom keeps the
// point under the pointer (or the middle for the buttons) fixed.
export function useCanvasView(
  currentProject: () => Project | undefined,
  viewport: Ref<Size>,
) {
  const zoom = ref(1)
  const scroll = ref<Scroll>({ x: 0, y: 0 })
  /** Whether the view still tracks the fit rather than a place the person chose. */
  const isAtFit = ref(true)

  /** The Canvas as the view stands, or at another zoom. */
  function surfaceOf(project: Pick<Project, 'technique' | 'techniqueSettings' | 'rotation'> & Partial<Pick<Project, 'frame' | 'beadId' | 'beadShape'>>): SurfaceView {
    return surfaceView({ space: OPEN_SPACE, technique: project.technique, techniqueSettings: project.techniqueSettings, cell: projectCell(project), frame: project.frame, rotation: project.rotation, zoom: zoom.value, scroll: scroll.value, viewport: viewport.value })
  }

  function measured(): boolean {
    return viewport.value.width > 0 && viewport.value.height > 0
  }

  /** Puts the view at the fit: the Frame or the drawing whole, or the origin in the middle for an empty canvas. */
  function fit(): void {
    const project = currentProject()
    if (!project) {
      return
    }
    const box = fitBox(project)
    if (!measured()) {
      // Nothing to fit to until the drawing area has a size: look at the origin at 100% and fit when it is measured.
      zoom.value = clampZoom(1)
      scroll.value = { x: 0, y: 0 }
    } else if (!box) {
      zoom.value = clampZoom(1)
      scroll.value = surfaceOf(project).scrollToCentre()
    } else {
      const layer = layerOfBox(project, box)
      zoom.value = clampZoom(surfaceOf(project).zoomToFit(box, FIT_MARGIN_PX, layer))
      scroll.value = surfaceOf(project).scrollToCentre(box, layer)
    }
    isAtFit.value = true
  }

  /** Moves the canvas under the viewport by a distance on screen (a drag, a wheel): the content follows the pointer,
   * so the scroll goes the other way. */
  function panBy(dx: number, dy: number): void {
    scroll.value = { x: scroll.value.x - dx, y: scroll.value.y - dy }
    isAtFit.value = false
  }

  /** Scrolls by a distance in the direction the content moves away from (the wheel's own sign). */
  function scrollBy(dx: number, dy: number): void {
    panBy(-dx, -dy)
  }

  /** Brings a block of beads into the middle of the view without changing the zoom. */
  function centreOn(box: Rect): void {
    const project = currentProject()
    if (!project) {
      return
    }
    scroll.value = surfaceOf(project).scrollToCentre(box, layerOfBox(project, box))
    isAtFit.value = false
  }

  /** The Canvas position under the middle of the view (ticket 495), or nothing until the area is measured. */
  function visibleCentre(): GridPosition | undefined {
    const project = currentProject()
    if (!project || !measured()) {
      return undefined
    }
    return surfaceOf(project).pointToCell({ x: viewport.value.width / 2, y: viewport.value.height / 2 }, 'canvas')
  }

  function setZoom(value: number, anchor?: Scroll): void {
    const next = clampZoom(value)
    if (next === zoom.value) {
      return
    }
    const at = anchor ?? { x: viewport.value.width / 2, y: viewport.value.height / 2 }
    // Keeping a point still under a zoom does not depend on what is drawn, so a Project is not needed.
    scroll.value = surfaceOf(currentProject() ?? { technique: DEFAULT_TECHNIQUE, rotation: 0 }).scrollAfterZoom(at, next)
    zoom.value = next
    isAtFit.value = false
  }

  watch(
    // Two sources, not one getter returning an array: a fresh array is "changed" on every edit, which refit the view on
    // every bead drawn.
    [() => currentProject()?.id, () => currentProject()?.rotation],
    () => {
      if (measured()) {
        fit()
      } else {
        isAtFit.value = true
      }
    },
  )

  watch(viewport, () => {
    if (!measured()) {
      return
    }
    if (isAtFit.value) {
      fit()
    } else {
      zoom.value = clampZoom(zoom.value)
    }
  })

  return {
    zoom,
    scroll,
    zoomPercent: computed(() => Math.round(zoom.value * 100)),
    zoomIn: (anchor?: Scroll) => setZoom(stepZoom(zoom.value, 1), anchor),
    zoomOut: (anchor?: Scroll) => setZoom(stepZoom(zoom.value, -1), anchor),
    /** A zoom the wheel or fingers chose: any level in the usable range rather than a step, about the point under
     * them. */
    setZoom,
    resetZoom: fit,
    fit,
    panBy,
    scrollBy,
    centreOn,
    visibleCentre,
    isAtFit,
  }
}
