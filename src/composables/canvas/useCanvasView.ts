import { computed, onScopeDispose, readonly, ref, watch, type Ref } from 'vue'
import { beadBounds, type Rect, sameFrame } from '../../domain/canvas'
import { clampZoom, MAX_ZOOM, MIN_ZOOM, stepZoom, type GridPosition } from '../../domain/grid'
import { laidFrame } from '../../domain/frameOrientation'
import { frameOf, layerOf, orientationOf } from '../../domain/layerRecord'
import { footprintOf, frameFootprint } from '../../domain/footprint'
import { withMargin } from '../../domain/margin'
import { NO_INSETS, type Insets } from '../../domain/toolPill'
import { nearestQuarterTurn, settledOrientation, tiltOf, turnedOrientation } from '../../domain/canvasOrientation'
import { frameAngleOf, settledFrameAngle } from '../../domain/table'
import { placedFrame } from '../../domain/layerWeave'
import type { KeptView } from '../../domain/keptView'
import type { OpeningView } from '../../domain/openingAddress'
import type { Project } from '../../domain/project'
import { DEFAULT_TECHNIQUE } from '../../domain/weave'
import { INTO_VIEW_MS, SNAP_MS } from '../../rendering/gestureView'
import { easeStandard } from '../../rendering/rowMotion'
import { shortestPan } from '../../rendering/shortestPan'
import { visibleBeadsInSpace } from '../../rendering/projectRenderer'
import { OPEN_SPACE } from '../../rendering/space'
import { surfaceView, type Region, type Scroll, type SurfaceView, type ViewLayer } from '../../rendering/surfaceView'
import { CELL_SIZE_PX, type Size } from '../../rendering/cellSize'
import { drawingScrollOf, originTurnedAbout, tableScrollOf, tiltedView } from '../../rendering/tiltedView'

/** One step of a two-finger gesture (ticket 0709), about `anchor`, a point of the viewport the fingers are at: the
 * zoom their spread asks for, how far their middle moved on screen, and how far they turned since the last step. `turn`
 * is left out until the twist engages (the fingers have turned past the threshold); it is 0 on the step it does. */
export interface PinchStep {
  zoom?: number
  pan?: Scroll
  turn?: number
  anchor: Scroll
  /** The layer a twist turns, chosen where the fingers started (ticket 1190): the Canvas when left out. */
  target?: TwistTarget
}

/** The layer a two-finger twist turns (ticket 1190): the Frame where both fingers started on its sheet, else the
 * Canvas. Pan and pinch move both whatever it is. */
export type TwistTarget = 'canvas' | 'frame'

/** Where a two-finger twist stands (ticket 0709): under the fingers, or easing onto the quarter turn it snaps to after
 * they lifted. The surface holds its drawing and turns it whole while either is set. */
export type TwistPhase = 'turning' | 'settling'

/** The rulers' gutter round drawn beads (CanvasStrip and BeadBoard cards). */
export const RULER_GUTTER_PX = 28

/** Room left clear round the drawn beads at the fit level: the ruler gutter and a little air.
 * @internal Its test works out the fit zoom with it. */
export const FIT_MARGIN_PX: Size = { width: 64, height: 46 }

/** Room left clear round the Frame's Margin sheet at the fit level: the air alone, as the sheet's band holds the
 * rulers (ticket 0850). */
const SHEET_FIT_MARGIN_PX: Size = { width: FIT_MARGIN_PX.width - RULER_GUTTER_PX, height: FIT_MARGIN_PX.height - RULER_GUTTER_PX }

/** The largest a Frame's bead is drawn at the fit level, bead to bead (ticket 0964, CanvasStrip card): Fit zooms a
 * small Frame's sheet past 100% until it fills the room or its beads reach this; with no Frame it stops at 100%.
 * @internal Its test works out the fit zoom with it. */
export const LARGEST_FIT_BEAD_PX = 48

/** How many times the expanded fit works out its zoom and the room it leaves, the sheet's numbers growing with the bead
 * (ticket 1194). */
const EXPANDED_FIT_PASSES = 6
/** A zoom out resting under this share of the expanded fit goes back to the Canvas; above it, the view springs back
 * (ticket 1194). */
const LEAVES_EXPANDED_UNDER = 0.95
/** How long a wheel or button zoom stays still before it counts as at rest (ticket 1194). */
const ZOOM_REST_MS = 150
/** How far two fingers carry an expanded Frame, in px on screen, before it counts as a pan by hand and goes back to the
 * Canvas, unless their spread has zoomed it by this share or more meanwhile (a pinch zoom carries its fingers along). */
const PAN_LEAVES_EXPANDED_PX = 24
const PINCH_ZOOMS_PAST = 0.1
/** How far past the expanded fit a zoom in may go, as a share of it. */
const EXPANDED_ZOOM_IN_SHARE = 2
/** A button's zoom step beyond the usual ceiling, where `stepZoom` stops. */
const BUTTON_ZOOM_STEP = 1.25

/** What a view fits to and centres on, a block of the Canvas's positions, and the room left clear round it. */
interface FitTarget {
  box: Rect
  margin: Size
}

/** What a view fits to: the Frame with its keep-out margin, its Margin sheet, when there is one (ticket 0850, so the
 * sheet's title block is in view), otherwise the box round every bead, otherwise nothing; what the Frame panel keeps
 * clear of itself too (ticket 0971). */
export function fitBox(project: Project): FitTarget | undefined {
  // The sheet is laid on the Canvas round the Frame's footprint, which takes a turned Frame as it lies (ticket 0667).
  // A Frame off the Canvas's grid covers no position (ticket 1188): the rectangle its address names is centred on it.
  const placed = placedFrame(project)
  const footprint = footprintOf(project) ?? (placed && frameFootprint(layerOf(project, 'canvas').weave, placed))
  if (footprint) return { box: withMargin(footprint), margin: SHEET_FIT_MARGIN_PX }
  const drawn = beadBounds(layerOf(project, 'canvas').beads)
  return drawn && { box: drawn, margin: FIT_MARGIN_PX }
}

/** The layer a block is measured in: the Frame's own for the Frame itself (ticket 492), the Canvas's for anything else. */
function layerOfBox(project: Project, box: Rect): ViewLayer {
  const frame = laidFrame(project)
  return frame && sameFrame(box, frame) ? 'frame' : 'canvas'
}

/** A move `bringIntoView` made (ticket 0971), so `putBack` can take it back: the scroll it went to, at which zoom, the
 * scroll it goes back to and whether the view follows the fit there. */
export interface ViewMove {
  back: Scroll
  to: Scroll
  zoom: number
  atFit: boolean
}

/** What the view does beyond looking: keeping the angle a twist settles on (ticket 0672). */
export interface CanvasViewOptions {
  /** Saves the Canvas's orientation a two-finger twist came to rest at with the Project, and how far its origin moved on
   * the table as it turned about the fingers, in its bead widths (ticket 1188). */
  keepTwist?: (orientation: number, moved: Scroll) => void
  /** Keeps the angle a twist of the Frame came to rest at (ticket 1190), one Undo step; 'asked' where the Rotate Frame
   * question comes first: the view then shows it there until `releaseFrameTwist` or `easeFrameBack`. */
  keepFrameTwist?: (angle: number) => 'kept' | 'asked'
  /** What lies over the drawing area's edges (the Tool pill, ticket 0850): a fit leaves it clear. */
  covered?: () => Insets
  /** The view a Project opens at in place of its fit, this once: the address's (What's inside's Open editor from here,
   * ticket 0879) or the one kept for a reload (ticket 1108). The first fit the view makes once measured takes it, if it
   * is that Project's. */
  opening?: { project: string; view: OpeningView | KeptView }
  /** While the Frame is expanded (MarginSheet card, Expand the Frame; ticket 1169): the room its slim sheet takes from
   * each side of the drawing area, past the Frame's beads, at a zoom and the bead pitch it makes. A fit then fits the
   * Frame's beads into the rest, clear of the Tool pill too (ticket 1176). */
  expanded?: () => ((zoom: number, pitch: number) => Insets) | undefined
  /** The expanded fit's bead pitch on screen, in px, once worked out (ticket 1194): the sheet's numbers grow with it. */
  fitted?: (pitch: number) => void
  /** A zoom out that rests under the expanded fit (ticket 1194), or a move of the view by hand: Back to the Canvas,
   * announced as its button is. */
  leaveExpanded?: () => void
}

/** A view to show: a zoom and the scroll at it. */
export interface ShownView {
  zoom: number
  scroll: Scroll
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
  /** The drawing's scroll: where its quarter turn is looked at from, before the lean. */
  const scroll = ref<Scroll>({ x: 0, y: 0 })
  /** Where the Canvas's origin lies on the table (spec 1182, ticket 1185), in grid px at zoom 1 along the screen's
   * axes: a twist swings it round the fingers, so the view's scroll over the table stays. */
  const canvasOrigin = ref<Scroll>({ x: 0, y: 0 })
  /** Whether the view still tracks the fit rather than a place the person chose. */
  const isAtFit = ref(true)
  /** Whether the view has been set for its measured area (ticket 0991): before it, zoom and scroll are stand-ins that
   * nothing laid over the drawing should be put at. */
  const placed = ref(false)
  /** The view the first measured fit opens at, until it has. */
  let opening = options.opening
  /** The Canvas's orientation while two fingers twist it, before the Project keeps where it settles. */
  const twisting = ref<number>()
  /** Where the Canvas's origin lay on the table as the twist began (ticket 1188): how far it has moved since is what the
   * Project keeps with the angle, so the Frame, which stays, is laid against the Canvas as it will be. */
  let twistFrom: Scroll | undefined
  const twistPhase = ref<TwistPhase>()
  /** The layer the twist under way turns, from the step it engages on (ticket 1190). */
  let twistTarget: TwistTarget | undefined
  /** The Frame's angle while two fingers twist it, it eases onto where it settles, or the Rotate Frame question waits
   * (ticket 1190): what the surface shows it at, before the Project keeps it. */
  const frameTwisting = ref<number>()
  let snapTimer: ReturnType<typeof setTimeout> | undefined
  /** The orientation this view just handed the Project, which it already shows: no refit for it. */
  let settledAt: number | undefined
  /** The frame of the glide `bringIntoView` plays, until it lands or the view is moved some other way, and where to. */
  let glide: number | undefined
  let gliding: Scroll | undefined
  /** Where `glideView` takes the view, while it does: a move by hand finishes the glide at once. */
  let glidingView: ShownView | undefined
  /** The zoom of the expanded fit as it was last worked out (ticket 1194): where a zoom out leaves or springs back, and
   * what the zoom ceiling is while expanded. */
  let expandedFitZoom: number | undefined
  let restTimer: ReturnType<typeof setTimeout> | undefined
  /** Two fingers are still down on an expanded Frame: a zoom out waits for them to lift. */
  let pinching = false
  /** The pinch under way as it found an expanded Frame: the zoom it began at and how far its fingers have carried the
   * view since, and whether it went back to the Canvas, the rest of it then panning and turning at the zoom it went
   * back to. */
  let pinchOnExpanded: { from: number; travel: number; left: boolean } | undefined

  /** The Canvas's orientation as shown: the twist's while one runs, else the Project's. */
  const orientation = computed(() => twisting.value ?? orientationOf(currentProject()) ?? 0)
  /** The screen as the drawing leans off its quarter turn. */
  const leaning = computed(() => tiltedView(viewport.value, tiltOf(orientation.value)))
  /** The view's scroll over the table (ticket 1185): pan and zoom move it, a turn of the Canvas never does. */
  const tableScroll = computed(() => tableScrollOf(scroll.value, viewport.value, { orientation: orientation.value, origin: canvasOrigin.value, zoom: zoom.value }))

  /** The drawing's scroll once the Canvas turns `from` one orientation `to` another about `anchor` (a point of the
   * viewport; its middle when left out): its placement on the table turns about the point under it, the table scroll
   * staying, so the bead under the anchor stays there. */
  function turnedAbout(drawing: Scroll, from: number, to: number, anchor: Scroll = { x: viewport.value.width / 2, y: viewport.value.height / 2 }): Scroll {
    const place = { orientation: from, origin: canvasOrigin.value, zoom: zoom.value }
    const table = tableScrollOf(drawing, viewport.value, place)
    canvasOrigin.value = originTurnedAbout(place.origin, { by: to - from, anchor, table, zoom: zoom.value })
    return drawingScrollOf(table, viewport.value, { ...place, orientation: to, origin: canvasOrigin.value })
  }

  /** The Canvas as the view stands, or from another scroll or in a part of the viewport; with no Project, an empty one
   * in the default Technique. */
  function surfaceOf(project: Project | undefined, at: Scroll = scroll.value, area: Size = viewport.value, atZoom: number = zoom.value): SurfaceView {
    const { technique, techniqueSettings, cell } = project ? layerOf(project, 'canvas').weave : { technique: DEFAULT_TECHNIQUE }
    return surfaceView({ space: OPEN_SPACE, technique, techniqueSettings, cell, frame: project && placedFrame(project), rotation: nearestQuarterTurn(orientation.value), zoom: atZoom, scroll: at, viewport: area })
  }

  /** The part of the viewport a fit uses (ticket 0850): all of it less what lies over its edges (and `also`, what else
   * lies over them for this once), while that leaves any; and where its top-left corner is. */
  function fitRoom(also: Insets = NO_INSETS): { area: Size; corner: Scroll } {
    const pill = options.covered?.() ?? NO_INSETS
    const clear = { top: Math.max(pill.top, also.top), right: Math.max(pill.right, also.right), bottom: Math.max(pill.bottom, also.bottom), left: Math.max(pill.left, also.left) }
    const area = { width: viewport.value.width - clear.left - clear.right, height: viewport.value.height - clear.top - clear.bottom }
    return area.width > 0 && area.height > 0 ? { area, corner: { x: clear.left, y: clear.top } } : { area: viewport.value, corner: { x: 0, y: 0 } }
  }

  /** The Frame's bead's longer step at zoom 1, in px. */
  function pitchAtFull(surface: SurfaceView): number {
    const { column, row } = surface.beadStep('frame')
    return Math.max(Math.hypot(column.x, column.y), Math.hypot(row.x, row.y)) / surface.zoom
  }

  /** The zoom a Frame's fit goes up to (ticket 0964): where its bead's longer step is LARGEST_FIT_BEAD_PX, and never
   * under 100%, so a Frame of large beads fits as it did. */
  function frameFitCeiling(surface: SurfaceView): number {
    const stepAtFull = pitchAtFull(surface)
    // To a whole percent, so the step worked out at another zoom doesn't round the ceiling down a percent.
    return Math.max(1, Math.round((LARGEST_FIT_BEAD_PX / stepAtFull) * 100) / 100)
  }

  /** Keeps a zoom inside the range: the usual one, and while the Frame is expanded as far past its fit as a zoom in may go
   * (ticket 1194: the fit of a small Frame reaches past 400%). */
  function limitZoom(value: number): number {
    const ceiling = options.expanded?.() && expandedFitZoom !== undefined ? Math.max(MAX_ZOOM, expandedFitZoom * EXPANDED_ZOOM_IN_SHARE) : MAX_ZOOM
    return Math.max(MIN_ZOOM, Math.min(ceiling, value))
  }

  /** A button step from the zoom, past the usual ceiling too while expanded. */
  function stepFrom(direction: 1 | -1): number {
    if (direction === 1 && zoom.value >= MAX_ZOOM) return zoom.value * BUTTON_ZOOM_STEP
    if (direction === -1 && zoom.value > MAX_ZOOM) return zoom.value / BUTTON_ZOOM_STEP
    return stepZoom(zoom.value, direction)
  }

  /** A zoom of an expanded Frame came to rest (ticket 1194): under about 95% of its fit it goes back to the Canvas, over
   * that and under the fit it springs back to it, and a zoom in stays. */
  function settleExpandedZoom(): void {
    if (!options.expanded?.() || expandedFitZoom === undefined || pinching) return
    if (zoom.value < expandedFitZoom * LEAVES_EXPANDED_UNDER) options.leaveExpanded?.()
    else if (zoom.value < expandedFitZoom) fit({ glide: true })
  }

  function restSoon(wait: number): void {
    clearTimeout(restTimer)
    if (options.expanded?.()) restTimer = setTimeout(settleExpandedZoom, wait)
  }

  function measured(): boolean {
    return viewport.value.width > 0 && viewport.value.height > 0
  }

  /** The expanded Frame's fit (ticket 1169): its beads as large as the room its sheet and the Tool pill leave allows,
   * with no zoom limit (ticket 1194), centred there. Worked out until it settles, as the sheet's numbers grow with the
   * bead and the Frame's line, which the sheet stands off, moves with the zoom. */
  function expandedFit(project: Project, sheetRoom: (zoom: number, pitch: number) => Insets): ShownView | undefined {
    const footprint = footprintOf(project)
    if (!footprint) return undefined
    const pill = options.covered?.() ?? NO_INSETS
    const room = (at: number, full: number): Insets => {
      const sheet = sheetRoom(at, full * at)
      return { top: sheet.top + pill.top, right: sheet.right + pill.right, bottom: sheet.bottom + pill.bottom, left: sheet.left + pill.left }
    }
    const full = pitchAtFull(surfaceOf(project))
    let at = 1
    let before = at
    let insets = room(at, full)
    let area = viewport.value
    for (let pass = 0; pass < EXPANDED_FIT_PASSES; pass += 1) {
      area = { width: Math.max(1, viewport.value.width - insets.left - insets.right), height: Math.max(1, viewport.value.height - insets.top - insets.bottom) }
      const surface = surfaceOf(project, scroll.value, area)
      before = at
      const wanted = surface.zoomToFit(footprint, { width: 0, height: 0 }, 'canvas', Infinity)
      at = Number.isFinite(wanted) ? Math.max(MIN_ZOOM, wanted) : 1
      if (at === before) break
      insets = room(at, full)
    }
    // A fit that keeps flipping between two sizes takes the smaller, which fits.
    if (at !== before) {
      at = Math.min(at, before)
      insets = room(at, full)
      area = { width: Math.max(1, viewport.value.width - insets.left - insets.right), height: Math.max(1, viewport.value.height - insets.top - insets.bottom) }
    }
    options.fitted?.(full * at)
    expandedFitZoom = at
    const centred = surfaceOf(project, scroll.value, area, at).scrollToCentre(footprint, 'canvas')
    return { zoom: at, scroll: { x: centred.x - insets.left, y: centred.y - insets.top } }
  }

  /** Puts the view at the fit: the Frame's sheet or the drawing whole, or the origin in the middle for an empty canvas,
   * in the room the Tool pill leaves; the expanded Frame in its own room, gliding there when `glide` asks. */
  function fit({ glide = false }: { glide?: boolean } = {}): void {
    stopGlide()
    const project = currentProject()
    if (!project) {
      return
    }
    const room = options.expanded?.()
    const expanded = room && measured() ? expandedFit(project, room) : undefined
    if (expanded) {
      opening = undefined
      isAtFit.value = true
      glideView(expanded, !glide)
      return
    }
    const target = fitBox(project)
    if (!measured()) {
      // Nothing to fit to until the drawing area has a size: look at the origin at 100% and fit when it is measured.
      zoom.value = clampZoom(1)
      scroll.value = { x: 0, y: 0 }
    } else if (opening?.project === project.id) {
      // The bead the address names, or the point kept for a reload, in the middle of the whole drawing area, as the
      // middle of the view is counted.
      const { view } = opening
      zoom.value = clampZoom(view.zoom)
      scroll.value = 'at' in view ? surfaceOf(project).scrollToCentre({ ...view.at, rows: 1, columns: 1 }, 'canvas') : scrollAround(view.middle)
      opening = undefined
      isAtFit.value = false
      return
    } else {
      opening = undefined
      const { area, corner } = fitRoom()
      const surface = surfaceOf(project, scroll.value, area)
      const most = frameOf(project) ? frameFitCeiling(surface) : 1
      zoom.value = clampZoom(target ? surface.zoomToFit(target.box, target.margin, 'canvas', most) : 1)
      const centred = surfaceOf(project, scroll.value, area).scrollToCentre(target?.box, 'canvas')
      scroll.value = { x: centred.x - corner.x, y: centred.y - corner.y }
    }
    isAtFit.value = true
  }

  /** The scroll that puts a point of the drawing (in its pixels at the zoom) in the middle of the drawing area. */
  function scrollAround(middle: Scroll): Scroll {
    return { x: middle.x - viewport.value.width / 2, y: middle.y - viewport.value.height / 2 }
  }

  /** The view to open a reload at (ticket 1108): none while it follows the fit, which a reload makes anew for the window
   * as it is then, or before the area is measured. */
  function keptView(): KeptView | undefined {
    if (isAtFit.value || !measured()) return undefined
    const at = gliding ?? scroll.value
    return { zoom: zoom.value, middle: { x: at.x + viewport.value.width / 2, y: at.y + viewport.value.height / 2 } }
  }

  /** A move of the view by hand while the Frame is expanded (a drag, a scroll, a two-finger pan or twist, Rotate
   * canvas): Back to the Canvas first, at once rather than gliding, for the move to go on from there. Whether it was. */
  function leaveByHand(): boolean {
    if (!options.expanded?.()) return false
    options.leaveExpanded?.()
    const to = glidingView
    if (to) {
      stopGlide()
      zoom.value = to.zoom
      scroll.value = to.scroll
    }
    return true
  }

  /** Moves the canvas under the viewport by a distance on screen by hand (a drag, the Hand tool, a wheel): the content
   * follows the pointer, so the scroll goes the other way. An expanded Frame goes back to the Canvas first. */
  function panBy(dx: number, dy: number): void {
    leaveByHand()
    carryBy(dx, dy)
  }

  /** Moves the canvas as `panBy` does, the Frame staying expanded: the edge scroll a drag near the edge carries. */
  function carryBy(dx: number, dy: number): void {
    stopGlide()
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
    stopGlide()
    const project = currentProject()
    if (!project) {
      return
    }
    scroll.value = surfaceOf(project).scrollToCentre(box, layerOfBox(project, box))
    isAtFit.value = false
  }

  function stopGlide(): void {
    if (glide !== undefined) cancelAnimationFrame(glide)
    glide = undefined
    gliding = undefined
    glidingView = undefined
  }

  /** Moves the view to a zoom and a scroll together, eased over the base duration, or at once under reduced motion or
   * when `jump` asks: Expand the Frame and Back to the Canvas (ticket 1169). */
  function glideView(to: ShownView, jump: boolean): void {
    stopGlide()
    const from = { zoom: zoom.value, scroll: scroll.value }
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (jump || still || typeof requestAnimationFrame !== 'function' || (from.zoom === to.zoom && from.scroll.x === to.scroll.x && from.scroll.y === to.scroll.y)) {
      zoom.value = to.zoom
      scroll.value = to.scroll
      return
    }
    gliding = to.scroll
    glidingView = to
    let start: number | undefined
    const step = (time: number) => {
      start ??= time
      const eased = easeStandard(Math.min(1, (time - start) / INTO_VIEW_MS))
      const done = eased >= 1
      zoom.value = done ? to.zoom : from.zoom + (to.zoom - from.zoom) * eased
      scroll.value = done ? to.scroll : { x: from.scroll.x + (to.scroll.x - from.scroll.x) * eased, y: from.scroll.y + (to.scroll.y - from.scroll.y) * eased }
      if (!done) glide = requestAnimationFrame(step)
      else {
        glide = gliding = undefined
        glidingView = undefined
      }
    }
    glide = requestAnimationFrame(step)
  }

  /** Puts back a view kept before (Back to the Canvas, ticket 1169): gliding there, and following the fit again if it
   * was. */
  function showView(view: ShownView & { atFit: boolean }): void {
    glideView(view, false)
    isAtFit.value = view.atFit
  }

  /** Moves the view to a scroll, eased over the base duration, or at once under reduced motion or when `jump` asks. */
  function glideTo(to: Scroll, jump: boolean): void {
    stopGlide()
    const from = scroll.value
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (jump || still || typeof requestAnimationFrame !== 'function') {
      scroll.value = to
      return
    }
    gliding = to
    // The first frame's own time starts it: rAF's clock is not always performance.now()'s.
    let start: number | undefined
    const step = (time: number) => {
      start ??= time
      const eased = easeStandard(Math.min(1, (time - start) / INTO_VIEW_MS))
      // It lands on `to` itself, so `putBack` finds the view where the move left it.
      scroll.value = eased < 1 ? { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased } : to
      if (eased < 1) glide = requestAnimationFrame(step)
      else glide = gliding = undefined
    }
    glide = requestAnimationFrame(step)
  }

  /** Pans the shortest way that brings a part of the drawing into the room the Tool pill (and `clear`, the Frame panel,
   * ticket 0971) leaves, zoom untouched (ticket 0934), gliding or a jump. One in the room, or missing it by `slack` at most
   * (px, as `clear`), or none, moves nothing and the view keeps following the fit. Returns the move, for `putBack`. */
  function bringIntoView(locate: (surface: SurfaceView) => Region | undefined, { jump = false, clear = NO_INSETS, slack = 0 }: { jump?: boolean; clear?: Insets; slack?: number } = {}): ViewMove | undefined {
    const project = currentProject()
    const found = project && measured() ? locate(surfaceOf(project)) : undefined
    if (!found) return undefined
    const { offset, screenBox } = leaning.value
    const shown = screenBox({ ...found, x: found.x + offset.x, y: found.y + offset.y })
    const move = panInto(shown, clear)
    if (Math.abs(move.x) <= slack && Math.abs(move.y) <= slack) return undefined
    const before = scroll.value
    const to = scrollAfter(before, move)
    // Back where it was, or, where the move brought the part into view, only as far as keeps it there.
    const back = scrollAfter(before, panInto(shown))
    const made = { back, to, zoom: zoom.value, atFit: isAtFit.value && back.x === before.x && back.y === before.y }
    isAtFit.value = false
    glideTo(to, jump)
    return made
  }

  /** The shortest pan on screen that brings a block on screen into the room the Tool pill and `clear` leave. */
  function panInto(shown: Region, clear: Insets = NO_INSETS): Scroll {
    const { area, corner } = fitRoom(clear)
    return shortestPan(shown, { ...corner, ...area })
  }

  /** The scroll after a pan on screen from `from`: the content follows the pan, so the scroll goes the other way. */
  function scrollAfter(from: Scroll, pan: Scroll): Scroll {
    const across = leaning.value.unturned(pan)
    return { x: from.x - across.x, y: from.y - across.y }
  }

  /** Takes back a move `bringIntoView` made (ticket 0971), the same way it came, while the view is still where it took
   * it (or on its way there); a view the person has moved or zoomed since stays where they left it. */
  function putBack(move: ViewMove): void {
    const there = scroll.value.x === move.to.x && scroll.value.y === move.to.y
    const onTheWay = gliding !== undefined && gliding.x === move.to.x && gliding.y === move.to.y
    if (zoom.value !== move.zoom || !(there || onTheWay)) return
    glideTo(move.back, false)
    isAtFit.value = move.atFit
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
  function pinchStep({ zoom: toZoom, pan, turn, anchor, target }: PinchStep): void {
    twistTarget ??= turn === undefined ? undefined : (target ?? 'canvas')
    if (options.expanded?.()) leaveByFingers(toZoom, pan, turn === undefined ? undefined : twistTarget)
    stopGlide()
    let at = scroll.value
    const next = toZoom === undefined || pinchOnExpanded?.left ? zoom.value : limitZoom(toZoom)
    if (next !== zoom.value) {
      if (options.expanded?.()) pinching = true
      // The spread zooms about where the fingers were before this step's move, which the move then carries along.
      const was = pan ? { x: anchor.x - pan.x, y: anchor.y - pan.y } : anchor
      at = surfaceOf(currentProject(), at).scrollAfterZoom(leaning.value.toView(was), next)
      zoom.value = next
    }
    if (pan) {
      const across = leaning.value.unturned(pan)
      at = { x: at.x - across.x, y: at.y - across.y }
    }
    if (turn !== undefined && twistTarget === 'frame') {
      // The Frame turns about its own centre, which stays on the table: only its angle changes.
      frameTwisting.value = turnedOrientation(frameTwisting.value ?? frameAngleOf(currentProject()!), turn)
      clearTimeout(snapTimer)
      twistPhase.value = 'turning'
    } else if (turn !== undefined) {
      const from = orientation.value
      const to = turnedOrientation(from, turn)
      twistFrom ??= { ...canvasOrigin.value }
      at = turnedAbout(at, from, to, anchor)
      clearTimeout(snapTimer)
      twisting.value = to
      twistPhase.value = 'turning'
    }
    scroll.value = at
    isAtFit.value = false
  }

  /** A pinch step on the expanded Frame: a twist of the Canvas, or fingers that carry it farther than their spread
   * zooms it, go back to the Canvas; a twist of the Frame stays. */
  function leaveByFingers(toZoom: number | undefined, pan: Scroll | undefined, twisted: TwistTarget | undefined): void {
    const pinch = (pinchOnExpanded ??= { from: zoom.value, travel: 0, left: false })
    pinch.travel += pan ? Math.hypot(pan.x, pan.y) : 0
    if (twisted === 'frame') return
    const spread = toZoom === undefined ? 0 : Math.abs(toZoom / pinch.from - 1)
    const pans = pinch.travel > PAN_LEAVES_EXPANDED_PX && spread < PINCH_ZOOMS_PAST
    if (twisted !== 'canvas' && !pans) return
    pinch.left = leaveByHand()
    pinching = false
  }

  /** The fingers lifted (a point of the viewport): the twist comes to rest about them, easing onto a quarter turn
   * within about 10° of it, and the Project keeps the angle once it has. */
  function endTwist(anchor?: Scroll): void {
    pinchOnExpanded = undefined
    if (pinching) {
      pinching = false
      restSoon(0)
    }
    if (twistTarget === 'frame') return endFrameTwist()
    const from = twisting.value
    if (from === undefined) {
      return
    }
    const to = settledOrientation(from)
    scroll.value = turnedAbout(scroll.value, from, to, anchor)
    if (to === from) {
      settleTwist(to)
      return
    }
    twisting.value = to
    twistPhase.value = 'settling'
    snapTimer = setTimeout(() => settleTwist(to), SNAP_MS)
  }

  function settleTwist(to: number): void {
    const moved = twistMoved.value
    twisting.value = undefined
    twistPhase.value = undefined
    twistFrom = undefined
    twistTarget = undefined
    const turned = to !== orientationOf(currentProject())
    if (turned) settledAt = to
    if (turned || moved.x !== 0 || moved.y !== 0) options.keepTwist?.(to, moved)
  }

  /** The fingers lifted off a twist of the Frame (ticket 1190): it eases onto where `settledFrameAngle` puts it (the
   * surface slides it onto whole Canvas positions there) and the Project keeps it once it has. */
  function endFrameTwist(): void {
    const from = frameTwisting.value
    const project = currentProject()
    twistTarget = undefined
    if (from === undefined || !project) return
    const to = settledFrameAngle(project, from)
    if (to === from) return settleFrameTwist(to)
    frameTwisting.value = to
    twistPhase.value = 'settling'
    snapTimer = setTimeout(() => settleFrameTwist(to), SNAP_MS)
  }

  function settleFrameTwist(to: number): void {
    twistPhase.value = undefined
    const project = currentProject()
    if (!project || to === frameAngleOf(project) || options.keepFrameTwist?.(to) !== 'asked') frameTwisting.value = undefined
  }

  /** The Rotate Frame question a Frame twist waited on was answered and the Project keeps the angle: the Frame is shown
   * as the Project holds it again. */
  function releaseFrameTwist(): void {
    clearTimeout(snapTimer)
    frameTwisting.value = undefined
    twistPhase.value = undefined
  }

  /** The question a Frame twist waited on was answered Cancel (ticket 1190): the Frame eases back to the angle the
   * Project holds. The surface holds its drawing first, so the ease plays from where the Frame was shown. */
  function easeFrameBack(): void {
    if (frameTwisting.value === undefined) return
    clearTimeout(snapTimer)
    twistPhase.value = 'turning'
    const ease = () => {
      frameTwisting.value = frameAngleOf(currentProject()!)
      twistPhase.value = 'settling'
      snapTimer = setTimeout(releaseFrameTwist, SNAP_MS)
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(ease)
    else ease()
  }

  /** How far the Canvas's origin has moved on the table since the twist began, in its bead widths (ticket 1188): none
   * outside a twist. */
  const twistMoved = computed<Scroll>(() => {
    if (twisting.value === undefined || !twistFrom) return { x: 0, y: 0 }
    return { x: (canvasOrigin.value.x - twistFrom.x) / CELL_SIZE_PX, y: (canvasOrigin.value.y - twistFrom.y) / CELL_SIZE_PX }
  })

  /** Rotate canvas's turn (ticket 1188): the Canvas a quarter turn clockwise about the middle of the drawing area, the
   * view's scroll over the table kept; how far its origin moved on the table, in its bead widths, for the Project to
   * keep with the new angle. No refit: nothing but the Canvas turns. */
  function turnCanvas(to: number): Scroll {
    leaveByHand()
    const before = { ...canvasOrigin.value }
    stopGlide()
    scroll.value = turnedAbout(scroll.value, orientation.value, to)
    if (to !== orientation.value) settledAt = to
    return { x: (canvasOrigin.value.x - before.x) / CELL_SIZE_PX, y: (canvasOrigin.value.y - before.y) / CELL_SIZE_PX }
  }

  function setZoom(value: number, anchor?: Scroll): void {
    const next = limitZoom(value)
    if (next === zoom.value) {
      return
    }
    stopGlide()
    const at = anchor ? leaning.value.toView(anchor) : { x: viewport.value.width / 2, y: viewport.value.height / 2 }
    // Keeping a point still under a zoom does not depend on what is drawn, so a Project is not needed.
    scroll.value = surfaceOf(currentProject()).scrollAfterZoom(at, next)
    zoom.value = next
    isAtFit.value = false
    restSoon(ZOOM_REST_MS)
  }

  /** Shows the new Project, or a Canvas turned otherwise than by the view (Delete all), whole. */
  function refit(): void {
    if (measured()) {
      fit()
    } else {
      isAtFit.value = true
    }
  }

  // Two watches, not one getter returning an array: a fresh array is "changed" on every edit, which refit the view on
  // every bead drawn.
  onScopeDispose(() => {
    clearTimeout(snapTimer)
    clearTimeout(restTimer)
    stopGlide()
  })
  watch(() => currentProject()?.id, () => {
    clearTimeout(snapTimer)
    twisting.value = undefined
    twistPhase.value = undefined
    twistFrom = undefined
    twistTarget = undefined
    frameTwisting.value = undefined
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
      zoom.value = limitZoom(zoom.value)
    }
    placed.value = true
  })

  return {
    zoom,
    scroll,
    placed: readonly(placed),
    zoomPercent: computed(() => Math.round(zoom.value * 100)),
    zoomIn: (anchor?: Scroll) => setZoom(stepFrom(1), anchor),
    zoomOut: (anchor?: Scroll) => setZoom(stepFrom(-1), anchor),
    /** A zoom the wheel or fingers chose: any level in the usable range rather than a step, about the point under
     * them. */
    setZoom,
    resetZoom: () => fit(),
    fit,
    showView,
    panBy,
    carryBy,
    scrollBy,
    centreOn,
    bringIntoView,
    putBack,
    visibleCentre,
    keptView,
    canvasOnScreen,
    cellAt,
    isAtFit,
    orientation,
    tableScroll,
    twistPhase,
    twistMoved,
    /** The Frame's angle as a twist shows it, none outside one (ticket 1190). */
    frameTwist: readonly(frameTwisting),
    releaseFrameTwist,
    easeFrameBack,
    turnCanvas,
    pinchStep,
    endTwist,
  }
}
