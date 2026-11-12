import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { beadBounds, type Rect, sameFrame } from '../../domain/canvas'
import { clampZoom, stepZoom, type GridPosition } from '../../domain/grid'
import { laidFrame } from '../../domain/frameOrientation'
import { layerOf, orientationOf } from '../../domain/layerRecord'
import { footprintOf } from '../../domain/footprint'
import { withMargin } from '../../domain/margin'
import { NO_INSETS, type Insets } from '../../domain/toolPill'
import { nearestQuarterTurn, settledOrientation, tiltOf, turnedOrientation } from '../../domain/canvasOrientation'
import { placedFrame } from '../../domain/layerWeave'
import type { OpeningView } from '../../domain/openingAddress'
import type { Project } from '../../domain/project'
import { DEFAULT_TECHNIQUE } from '../../domain/weave'
import { SNAP_MS } from '../../rendering/gestureView'
import { visibleBeadsInSpace } from '../../rendering/projectRenderer'
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

/** The rulers' gutter round drawn beads (CanvasStrip and BeadBoard cards). */
const RULER_GUTTER_PX = 28

/** Room left clear round the drawn beads at the fit level: the ruler gutter and a little air.
 * @internal Its test works out the fit zoom with it. */
export const FIT_MARGIN_PX: Size = { width: 64, height: 46 }

/** Room left clear round the Frame's Margin sheet at the fit level: the air alone, as the sheet's band holds the
 * rulers (ticket 0850). */
const SHEET_FIT_MARGIN_PX: Size = { width: FIT_MARGIN_PX.width - RULER_GUTTER_PX, height: FIT_MARGIN_PX.height - RULER_GUTTER_PX }

/** What a view fits to and centres on, a block of the Canvas's positions, and the room left clear round it. */
interface FitTarget {
  box: Rect
  margin: Size
}

/** What a view fits to: the Frame with its keep-out margin, its Margin sheet, when there is one (ticket 0850, so the
 * sheet's title block is in view), otherwise the box round every bead, otherwise nothing.
 * @internal Its test checks what a view fits to on its own. */
export function fitBox(project: Project): FitTarget | undefined {
  // The sheet is laid on the Canvas round the Frame's footprint, which takes a turned Frame as it lies (ticket 0667).
  const footprint = footprintOf(project)
  if (footprint) return { box: withMargin(footprint), margin: SHEET_FIT_MARGIN_PX }
  const drawn = beadBounds(layerOf(project, 'canvas').beads)
  return drawn && { box: drawn, margin: FIT_MARGIN_PX }
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
  /** What lies over the drawing area's edges (the Tool pill, ticket 0850): a fit leaves it clear. */
  covered?: () => Insets
  /** The view a Project opens at in place of its fit, this once (What's inside's Open editor from here, ticket 0879):
   * the first fit the view makes once measured takes it, if it is that Project's. */
  opening?: { project: string; view: OpeningView }
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
  /** The view the first measured fit opens at, until it has. */
  let opening = options.opening
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

  /** The Canvas as the view stands, or from another scroll or in a part of the viewport; with no Project, an empty one
   * in the default Technique. */
  function surfaceOf(project: Project | undefined, at: Scroll = scroll.value, area: Size = viewport.value): SurfaceView {
    const { technique, techniqueSettings, cell } = project ? layerOf(project, 'canvas').weave : { technique: DEFAULT_TECHNIQUE }
    return surfaceView({ space: OPEN_SPACE, technique, techniqueSettings, cell, frame: project && placedFrame(project), rotation: nearestQuarterTurn(orientation.value), zoom: zoom.value, scroll: at, viewport: area })
  }

  /** The part of the viewport a fit uses (ticket 0850): all of it less what lies over its edges, while that leaves any;
   * and where its top-left corner is. */
  function fitRoom(): { area: Size; corner: Scroll } {
    const clear = options.covered?.() ?? NO_INSETS
    const area = { width: viewport.value.width - clear.left - clear.right, height: viewport.value.height - clear.top - clear.bottom }
    return area.width > 0 && area.height > 0 ? { area, corner: { x: clear.left, y: clear.top } } : { area: viewport.value, corner: { x: 0, y: 0 } }
  }

  function measured(): boolean {
    return viewport.value.width > 0 && viewport.value.height > 0
  }

  /** Puts the view at the fit: the Frame's sheet or the drawing whole, or the origin in the middle for an empty canvas,
   * in the room the Tool pill leaves. */
  function fit(): void {
    const project = currentProject()
    if (!project) {
      return
    }
    const target = fitBox(project)
    if (!measured()) {
      // Nothing to fit to until the drawing area has a size: look at the origin at 100% and fit when it is measured.
      zoom.value = clampZoom(1)
      scroll.value = { x: 0, y: 0 }
    } else if (opening?.project === project.id) {
      // The bead the opening names in the middle of the whole drawing area, as the middle of the view is counted.
      zoom.value = clampZoom(opening.view.zoom)
      scroll.value = surfaceOf(project).scrollToCentre({ ...opening.view.at, rows: 1, columns: 1 }, 'canvas')
      opening = undefined
      isAtFit.value = false
      return
    } else {
      opening = undefined
      const { area, corner } = fitRoom()
      zoom.value = clampZoom(target ? surfaceOf(project, scroll.value, area).zoomToFit(target.box, target.margin, 'canvas') : 1)
      const centred = surfaceOf(project, scroll.value, area).scrollToCentre(target?.box, 'canvas')
      scroll.value = { x: centred.x - corner.x, y: centred.y - corner.y }
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

  /** The Canvas positions on screen (Fill reach, ticket 0715): the block the renderer counts as in view of the drawing
   * as it stands, its larger square while the Canvas leans; nothing until the area is measured. */
  function canvasOnScreen(): Rect | undefined {
    const project = currentProject()
    if (!project || !measured()) {
      return undefined
    }
    const { offset, drawn } = leaning.value
    const region = { x: scroll.value.x - offset.x, y: scroll.value.y - offset.y, width: drawn.width, height: drawn.height }
    const seen = visibleBeadsInSpace(layerOf(project, 'canvas').weave, OPEN_SPACE, region, zoom.value, nearestQuarterTurn(orientation.value))
    // Offset rows reach half a bead further one way than the next: the block takes both in.
    const spans = [seen.columnsOf(seen.firstRow), seen.columnsOf(seen.firstRow + 1)]
    const first = Math.min(...spans.map((span) => span.first))
    const last = Math.max(...spans.map((span) => span.last))
    return { row: seen.firstRow, column: first, rows: seen.lastRow - seen.firstRow + 1, columns: last - first + 1 }
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

  // A pill moved to another edge, or grown, moves the fit as a new size of the area does.
  const coveredKey = () => Object.values(options.covered?.() ?? NO_INSETS).join()
  watch([viewport, coveredKey], () => {
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
    canvasOnScreen,
    cellAt,
    isAtFit,
    orientation,
    twistPhase,
    pinchStep,
    endTwist,
  }
}
