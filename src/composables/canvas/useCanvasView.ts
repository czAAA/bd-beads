import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { beadBounds, type Rect, sameFrame } from '../../domain/canvas'
import { clampZoom, stepZoom, type GridPosition } from '../../domain/grid'
import { laidFrame } from '../../domain/frameOrientation'
import { layerOf, orientationOf } from '../../domain/layerRecord'
import { nearestQuarterTurn, settledOrientation, tiltOf, turnedOrientation } from '../../domain/canvasOrientation'
import { placedFrame } from '../../domain/layerWeave'
import type { Project } from '../../domain/project'
import { DEFAULT_TECHNIQUE } from '../../domain/weave'
import { SNAP_MS } from '../../rendering/gestureView'
import { OPEN_SPACE } from '../../rendering/space'
import { surfaceView, type Scroll, type SurfaceView, type ViewLayer } from '../../rendering/surfaceView'
import type { Size } from '../../rendering/cellSize'
import { scrollAfterTurn, tiltedView } from '../../rendering/tiltedView'

/** One step of a two-finger gesture (ticket 0709), about `anchor`, a point of the viewport the fingers are at: the
 * zoom their spread asks for, how far their middle moved on screen, and how far they turned since the last step. `turn`
 * is left out until the twist engages (the fingers have turned past the threshold); it is 0 on the step it does. */
export interface PinchStep {
  zoom?: number
  pan?: Scroll
  turn?: number
  anchor: Scroll
}

/** Where a two-finger twist stands (ticket 0709): under the fingers, or easing onto the quarter turn it snaps to after
 * they lifted. The surface holds its drawing and turns it whole while either is set. */
export type TwistPhase = 'turning' | 'settling'

/** Room left clear round the Project at the fit level: the ruler gutter (28px) and a little air (CanvasStrip and
 * BeadBoard cards).
 * @internal Its test works out the fit zoom with it. */
export const FIT_MARGIN_PX: Size = { width: 64, height: 46 }

/** The block of beads a view fits to and centres on: the Frame when there is one, otherwise the box round every
 * bead, otherwise nothing.
 * @internal Its test checks what a view fits to on its own. */
export function fitBox(project: Project): Rect | undefined {
  // A turned Frame is fitted as it lies (ticket 0667).
  return laidFrame(project) ?? beadBounds(layerOf(project, 'canvas').beads)
}

/** The layer a block is measured in: the Frame's own for the Frame itself (ticket 492), the Canvas's for anything else. */
function layerOfBox(project: Project, box: Rect): ViewLayer {
  const frame = laidFrame(project)
  return frame && sameFrame(box, frame) ? 'frame' : 'canvas'
}

/** What the view does beyond looking: keeping the angle a twist settles on (ticket 0672). */
export interface CanvasViewOptions {
  /** Saves the Canvas's orientation a two-finger twist came to rest at with the Project. */
  keepTwist?: (orientation: number) => void
}

// Where the Canvas is looked at from (ADR 0026): zoom and scroll over an endless field. `fit` shows the Frame (or all
// drawn) whole until moved by hand; a zoom keeps the point under the pointer (or the middle) fixed. A twist turns it
// live and the Project keeps where it settles (ticket 0672); a point on screen is turned back by the lean first.
export function useCanvasView(
  currentProject: () => Project | undefined,
  viewport: Ref<Size>,
  options: CanvasViewOptions = {},
) {
  const zoom = ref(1)
  const scroll = ref<Scroll>({ x: 0, y: 0 })
  /** Whether the view still tracks the fit rather than a place the person chose. */
  const isAtFit = ref(true)
  /** The Canvas's orientation while two fingers twist it, before the Project keeps where it settles. */
  const twisting = ref<number>()
  const twistPhase = ref<TwistPhase>()
  let snapTimer: ReturnType<typeof setTimeout> | undefined
  /** The orientation this view just handed the Project, which it already shows: no refit for it. */
  let settledAt: number | undefined

  /** The Canvas's orientation as shown: the twist's while one runs, else the Project's. */
  const orientation = computed(() => twisting.value ?? orientationOf(currentProject()) ?? 0)
  /** The screen as the drawing leans off its quarter turn. */
  const leaning = computed(() => tiltedView(viewport.value, tiltOf(orientation.value)))

  /** The Canvas as the view stands, or from another scroll; with no Project, an empty one in the default Technique. */
  function surfaceOf(project: Project | undefined, at: Scroll = scroll.value): SurfaceView {
    const { technique, techniqueSettings, cell } = project ? layerOf(project, 'canvas').weave : { technique: DEFAULT_TECHNIQUE }
    return surfaceView({ space: OPEN_SPACE, technique, techniqueSettings, cell, frame: project && placedFrame(project), rotation: nearestQuarterTurn(orientation.value), zoom: zoom.value, scroll: at, viewport: viewport.value })
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
    const across = leaning.value.unturned({ x: dx, y: dy })
    scroll.value = { x: scroll.value.x - across.x, y: scroll.value.y - across.y }
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

  /** The Canvas position nearest a point of the screen, or nothing until the area is measured. */
  function cellAt(point: Scroll): GridPosition | undefined {
    const project = currentProject()
    if (!project || !measured()) {
      return undefined
    }
    return surfaceOf(project).pointToCell(leaning.value.toView(point), 'canvas')
  }

  /** The Canvas position under the middle of the view (ticket 495), or nothing until the area is measured. */
  function visibleCentre(): GridPosition | undefined {
    return cellAt({ x: viewport.value.width / 2, y: viewport.value.height / 2 })
  }

  /** The point of the Canvas, in its grid px, under the middle of the view (ticket 0704: where a Mirror Axis goes
   * when it is turned on), or nothing until the area is measured. */
  function visibleCentrePx(): Scroll | undefined {
    const project = currentProject()
    if (!project || !measured()) {
      return undefined
    }
    return surfaceOf(project).pointToGrid(leaning.value.toView({ x: viewport.value.width / 2, y: viewport.value.height / 2 }))
  }

  /** Two fingers moved (tickets 0672, 0709): the bead under them follows them, their spread zooms about it and, once
   * the twist has engaged, the Canvas turns about it, in one move of the view. */
  function pinchStep({ zoom: toZoom, pan, turn, anchor }: PinchStep): void {
    let at = scroll.value
    const next = toZoom === undefined ? zoom.value : clampZoom(toZoom)
    if (next !== zoom.value) {
      // The spread zooms about where the fingers were before this step's move, which the move then carries along.
      const was = pan ? { x: anchor.x - pan.x, y: anchor.y - pan.y } : anchor
      at = surfaceOf(currentProject(), at).scrollAfterZoom(leaning.value.toView(was), next)
      zoom.value = next
    }
    if (pan) {
      const across = leaning.value.unturned(pan)
      at = { x: at.x - across.x, y: at.y - across.y }
    }
    if (turn !== undefined) {
      const from = orientation.value
      const to = turnedOrientation(from, turn)
      at = scrollAfterTurn(at, viewport.value, { from, to, anchor })
      clearTimeout(snapTimer)
      twisting.value = to
      twistPhase.value = 'turning'
    }
    scroll.value = at
    isAtFit.value = false
  }

  /** The fingers lifted (a point of the viewport): the twist comes to rest about them, easing onto a quarter turn
   * within about 10° of it, and the Project keeps the angle once it has. */
  function endTwist(anchor?: Scroll): void {
    const from = twisting.value
    if (from === undefined) {
      return
    }
    const to = settledOrientation(from)
    scroll.value = scrollAfterTurn(scroll.value, viewport.value, { from, to, anchor })
    if (to === from) {
      settleTwist(to)
      return
    }
    twisting.value = to
    twistPhase.value = 'settling'
    snapTimer = setTimeout(() => settleTwist(to), SNAP_MS)
  }

  function settleTwist(to: number): void {
    twisting.value = undefined
    twistPhase.value = undefined
    if (to !== orientationOf(currentProject())) {
      settledAt = to
      options.keepTwist?.(to)
    }
  }

  function setZoom(value: number, anchor?: Scroll): void {
    const next = clampZoom(value)
    if (next === zoom.value) {
      return
    }
    const at = anchor ? leaning.value.toView(anchor) : { x: viewport.value.width / 2, y: viewport.value.height / 2 }
    // Keeping a point still under a zoom does not depend on what is drawn, so a Project is not needed.
    scroll.value = surfaceOf(currentProject()).scrollAfterZoom(at, next)
    zoom.value = next
    isAtFit.value = false
  }

  /** Shows the new Project, or a Canvas the button turned, whole. */
  function refit(): void {
    if (measured()) {
      fit()
    } else {
      isAtFit.value = true
    }
  }

  // Two watches, not one getter returning an array: a fresh array is "changed" on every edit, which refit the view on
  // every bead drawn.
  onScopeDispose(() => clearTimeout(snapTimer))
  watch(() => currentProject()?.id, () => {
    clearTimeout(snapTimer)
    twisting.value = undefined
    twistPhase.value = undefined
    refit()
  })
  watch(() => orientationOf(currentProject()), (turned) => {
    const twisted = turned === settledAt
    settledAt = undefined
    if (!twisted) refit()
  })

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
    visibleCentrePx,
    cellAt,
    isAtFit,
    orientation,
    twistPhase,
    pinchStep,
    endTwist,
  }
}
