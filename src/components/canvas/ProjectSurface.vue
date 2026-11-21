<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, toRef, useTemplateRef, watch } from 'vue'
import type { GridPosition, PreviewCell } from '../../domain/grid'
import { layerAt } from '../../domain/layers'
import type { Handedness, InputMode } from '../../domain/inputMode'
import { frameOf, layerOf, orientationOf, quarterTurnOf, withCanvas } from '../../domain/layerRecord'
import { frameAngleOf } from '../../domain/table'
import { frameCentreOnCanvas, withCanvasTurned, withFrameLaidAt } from '../../domain/framePlacement'
import type { TablePoint } from '../../domain/table'
import { CELL_SIZE_PX } from '../../rendering/cellSize'
import { nearestQuarterTurn, normalizedOrientation } from '../../domain/canvasOrientation'
import type { Rotation } from '../../domain/grid'
import { placedFrame } from '../../domain/layerWeave'
import { rowProgressOn } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { selectionFrame, selectionLayer, type PasteStamp, type Selection } from '../../domain/selection'
import { toolCapabilities, type ToolCapabilities } from '../../domain/tool'
import type { Size } from '../../rendering/cellSize'
import { SETTLE_MS, twistTransform } from '../../rendering/gestureView'
import { marginForm, marginScale } from '../../rendering/marginForm'
import { marginSheetPx, type SlimSheet } from '../../rendering/projectRenderer'
import { MARGIN_PX } from '../../rendering/marginSizes'
import { rulerFontAtFull } from '../../rendering/rulerScale'
import { slimSheetSides, type SlimContent } from '../../rendering/slimSheet'
import type { DrawnReference } from '../../rendering/referenceImage'
import { rulerLayout, type RulerLayout } from '../../rendering/rulers'
import { ruledPieces, type RuledPieces } from '../../rendering/ruledPieces'
import { useIdlePieces } from '../../composables/canvas/idlePieces'
import { spaceOf } from '../../rendering/space'
import type { FrameAnchor, SelectionAnchor } from '../../composables/tools/selectionBarPlacement'
import type { SchemaAnchors } from '../../composables/canvas/schemaTagPlacement'
import { unframedSchemas } from '../../domain/schemaTags'
import { surfaceView, type Scroll, type SurfaceView, type SurfaceViewInput } from '../../rendering/surfaceView'
import type { TiltedView } from '../../rendering/tiltedView'
import { canvasDrawing, frameDrawing, seamOf, type LayerDrawing } from '../../rendering/layerDrawings'
import type { TwistPhase } from '../../composables/canvas/useCanvasView'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { cssZoomOf } from '../../composables/ui/cssZoom'
import { useBeadLayer, useFrameScheduler } from './surface/useSurfaceDrawing'
import { useCarryLayer } from './surface/useCarryLayer'
import type { CarriedPieceMove } from '../../composables/tools/useSelectionGesture'
import { useEmptyCanvasLook } from './surface/useEmptyCanvasLook'
import { useMarginCue, useSurfaceOverlay } from './surface/useSurfaceOverlay'
import type { MirrorSetting } from '../../domain/mirror'
import { useSurfacePointer, type SurfacePointerEvents } from './surface/useSurfacePointer'
import { useRowMotion } from './surface/useRowMotion'
import { useFrameTurn } from './surface/useFrameTurn'
import type { RowPress } from '../../composables/project/useRowOps'
import PatternDone from './PatternDone.vue'
import { loadCatalogWhen, useBeadColorsList } from '../../composables/palette/useBeadColors'
import { projectPalette } from '../../domain/palette'
import { colorLabel } from '../../i18n/colorLabel'
import { useI18n } from '../../i18n/useI18n'
import { PATTERN_DONE_STARS } from '../../rendering/rowMotion'

// The Canvas drawn by the Project renderer (ADR 0018, ADR 0026), the Drawing surface of CONTEXT.md: two screen-sized
// canvases (beads and dots; overlay: see overlayRenderer), no board; `scroll` and `zoom` decide what shows. Its parts
// (ticket 0619): the draw scheduler and beads' layer, the overlay, and the pointer and cursor, wired here.
const props = withDefaults(defineProps<{
  project: Project
  /** How much the canvas is enlarged by; 1 is a bead 20 px across. */
  zoom: number
  /** Where the viewport's top-left corner is, in displayed px from the bead at row 0, column 0 (see the Surface
   * view). */
  scroll: Scroll
  /** The Canvas's orientation as shown, in degrees: live while two fingers twist it (ticket 0672); the Project's when
   * left out. */
  orientation?: number
  /** Whether two fingers twist the Canvas, or it eases onto a quarter turn after them (ticket 0709): the drawing is
   * held as it is and turned whole until it is over. */
  twist?: TwistPhase
  /** How far the Canvas's origin has moved on the table while two fingers twist it, in its bead widths (ticket 1188):
   * the Frame stays where it is, so it is laid against the Canvas as it will be once the Project keeps the turn. */
  twistMoved?: TablePoint
  /** What the tool in hand and the modes on let a press, the pointer and the overlay do (ticket 0619,
   * `toolCapabilities`); absent, no tool is in hand and the bead-shaped marker shows over the beads. */
  tools?: ToolCapabilities
  /** Beads to show a hover preview on (ticket 23): the hovered bead, or a whole
   * copied block under the cursor (ticket 31). */
  previewCells?: PreviewCell[]
  /** A copied block under the cursor on a grid, aimed where Paste would land it (ticket 0675): drawn only where it
   * shows. */
  previewStamp?: PasteStamp
  /** The color to preview, faintly, on beads that carry none of their own; null for a neutral outline when no
   * Palette color is selected. */
  previewColor?: string | null
  /** The bead or empty position the open Radial toolbox was pressed on (ticket 1076): it keeps the hover's neutral
   * outline, so it is clear which bead Pick color from Canvas means once the ring has moved off it. */
  outlinedCell?: GridPosition
  /** The rectangle the Select tool has marked out, drawn as a marquee over those beads (ticket 31). */
  selection?: Selection
  /** A Canvas Piece held by its move grip (ticket 1151): drawn once on a canvas of its own over `project`, which has it
   * lifted out, and laid where the pointer has brought it. */
  carriedPiece?: CarriedPieceMove
  /** The Project's accessible name: it is one image to a screen reader, summed up (ScreenReaders card). */
  label?: string
  /** Which pointer draws and which one moves the canvas (ticket 325); absent, every pointer draws. */
  inputMode?: InputMode
  /** Which hand holds the pen: its marker stands off the tip away from that hand. Right when not given. */
  handedness?: Handedness
  /** Whether ruler numbers are drawn (the Rulers toggle), and the Pieces' lines with them; the Frame's line is drawn
   * either way. */
  showRulers?: boolean
  /** Whether a Paint or Eraser stroke is going on: the rulers then keep their Pieces until it ends (ticket 0674). */
  stroking?: boolean
  /** Whether the Row progress look is drawn (ticket 474): finished rows dimmed, the current row ringed and lifted. */
  rowMarks?: boolean
  /** The size tooltip's text at the Frame's corner while it is being set ("13×13 ≈ 2.1 × 2.1 cm"). */
  frameTooltip?: string
  /** The size beside a hot corner of the Selection and of the Mirror's Canvas Area (ticket 0807), as their bars read. */
  selectionTooltip?: string
  areaTooltip?: string
  /** How many Selections have been refused off the pointer (a Shift+arrow into the margin, a Piece tap there, ticket
   * 433): each one shows the not-allowed cue, the margin outline for 1s. */
  selectionRefusals?: number
  /** The Mirror (ADR 0082): the overlay draws its Area and Axis lines while it is on, and in Mirror mode a Canvas Area's
   * handles take a press as the Selection's do. */
  mirror?: MirrorSetting
  /** How many Fill presses Fill reach has refused (ticket 0715): each shows the not-allowed pointer for 1s. */
  fillRefusals?: number
  /** The last press of Row done or Row not done (ticket 0730): the Pattern's motion plays from it, never from the
   * pointer changing. */
  rowPress?: RowPress
  /** How many times Rotate Frame has been pressed (ticket 1016): each press is seen turning, never an Undo. */
  frameTurns?: number
  /** The reference image to draw under the beads (ticket 0790), none while it is hidden. */
  reference?: DrawnReference
  /** Whether a hold with the drawing pointer opens the Radial toolbox (ticket 1065); absent, no hold is timed. */
  holdOpens?: boolean
  /** How many holds a pinch has ended (ticket 1065): each stops the hold being timed. */
  holdEnds?: number
  /** Whether the Radial toolbox is open: the press it opens on then moves it here (ticket 1147). */
  toolboxOpen?: boolean
  /** What the expanded Frame's slim sheet holds (MarginSheet card, Expand the Frame; ticket 1169), none unexpanded: the
   * sheet is laid round the Frame's line from it, its numbers are the 100% ones, and a press off the Frame is refused. */
  slim?: SlimContent
}>(), { rowMarks: true, tools: () => toolCapabilities(undefined) })

const emit = defineEmits<SurfacePointerEvents & {
  /** The Selection's rectangle in the surface's pixels (ticket 415), or none: where the Selection bar anchors.
   * Follows pan and zoom. */
  'selection-anchor': [anchor: SelectionAnchor | undefined]
  /** The Mirror's Area in the surface's pixels (ADR 0082), or none while it is off: where the Mirror bar anchors, above
   * a Canvas Area or above the whole Frame's margin sheet. Follows pan and zoom. */
  'mirror-anchor': [anchor: SelectionAnchor | undefined]
  /** The Frame's and its margin sheet's rectangles in the surface's pixels (tickets 417, 473, 0657), or none once the
   * sheet is out of view: where the sheet's tools and title block sit. */
  'frame-anchor': [anchor: FrameAnchor | undefined]
  /** The unframed Schemas' boxes in the surface's pixels (ticket 0721), the Piece outset included: where their hang
   * tags hang from. Follows pan and zoom. */
  'schema-anchors': [anchors: SchemaAnchors | undefined]
  /** Every bead in view was drawn (ticket 0716's safe start). */
  drawn: []
  /** The view the layers are drawn through, for what stands over the drawing in its px (Adjust, ticket 0790). */
  'surface-view': [view: SurfaceView]
}>()

/** The colors the beads are drawn in follow the app's theme and each layer's own Background (ticket 0666); a change
 * redraws both layers. */
const canvasBackground = useCanvasBackground(() => props.project)
/** This shell's idle Piece walks (ticket 0797). */
const piecesWhenIdle = useIdlePieces()
const theme = canvasBackground.projectTheme
const frameTheme = canvasBackground.frameTheme

const rootEl = ref<HTMLElement>()
const baseEl = ref<HTMLCanvasElement>()
const overlayEl = ref<HTMLCanvasElement>()
const fadeEl = ref<HTMLCanvasElement>()
const turnEl = ref<HTMLCanvasElement>()
const standInEl = ref<HTMLCanvasElement>()
const canvasOverlayEl = ref<HTMLCanvasElement>()
const frameBaseEl = ref<HTMLCanvasElement>()
const frameStandInEl = ref<HTMLCanvasElement>()
const carryEl = ref<HTMLCanvasElement>()

/** How big the surface is in its own px, measured: the canvases are exactly this big. */
const size = ref({ width: 0, height: 0 })
/** The CSS zoom the surface is drawn at (ticket 1071): the Homepage draws its demo larger; the editor is at 1. */
let drawnZoom = 1
let resizeObserver: ResizeObserver | undefined

function measure(): void {
  const root = rootEl.value
  if (!root) return
  const box = root.getBoundingClientRect()
  const zoom = cssZoomOf(root)
  const width = Math.round(box.width / zoom)
  const height = Math.round(box.height / zoom)
  // A new zoom alone draws the canvases again, at the device's pixels it now covers.
  if (width !== size.value.width || height !== size.value.height || zoom !== drawnZoom) {
    drawnZoom = zoom
    size.value = { width, height }
  }
}

// A layer twisted off a quarter turn (ticket 0672) is drawn at that quarter turn on a larger square turned the rest
// about the surface's middle (`tiltedView`), so its hit test, rulers and handles keep the quarter turn's own mapping.
// The Canvas and the Frame are drawn on two stacked surfaces, each leaning on its own (ticket 1187).
const shownOrientation = computed(() => props.orientation ?? orientationOf(props.project))
/** The Canvas's drawing: its quarter turn, its lean and the scroll it is drawn from. */
const canvasDrawn = computed(() => canvasDrawing(size.value, shownOrientation.value, props.scroll))
const quarterTurn = computed(() => canvasDrawn.value.rotation)
const leaning = computed(() => canvasDrawn.value.leaning)
/** The Project as a drawing at `rotation` sees it: itself, unless its Canvas is drawn at another quarter turn (a live
 * twist past half way, or the Frame's own surface). */
const projectAt = (rotation: Rotation): Project => (quarterTurnOf(props.project) === rotation ? props.project : withCanvas(props.project, { orientation: rotation }))
/** The Project as a live twist shows it (ticket 1188): its Canvas at the angle shown, moved as the view turned it, the
 * Frame staying where it is on the table. */
const shownProject = computed(() => (props.orientation === undefined && !props.twistMoved ? props.project : withCanvasTurned(props.project, shownOrientation.value, props.twistMoved)))
/** The Project at the quarter turn it is drawn at: itself, unless a live twist has passed half way to another. */
const drawnProject = computed(() => projectAt(quarterTurn.value))
/** Where the drawing's top-left is: the view's scroll, less how far the larger square reaches past the surface. */
const drawnScroll = computed(() => canvasDrawn.value.scroll)
const drawnSize = computed(() => leaning.value.drawn)
/** The props as a view of the drawing sees them: the Project at its quarter turn and the drawing's scroll. */
function viewProps(view: { project: Project; zoom: number; scroll: Scroll }): typeof props {
  return new Proxy(props, {
    get: (target, key) => (key === 'project' ? view.project : key === 'scroll' ? view.scroll : key === 'zoom' ? view.zoom : Reflect.get(target, key)),
  })
}
const drawnProps = viewProps({ get project() { return drawnProject.value }, get zoom() { return props.zoom }, get scroll() { return drawnScroll.value } })

/** Where the Project's positions live: built once and handed to both layers, so they can't disagree about where a
 * position is. */
const space = computed(() => spaceOf(props.project, true))

/** The Canvas's Weave (ADR 0079), with the cell its Bead draws it in. */
const canvasWeave = computed(() => layerOf(props.project, 'canvas').weave)

/** A view of the drawing at a quarter turn, from a scroll, over a drawing area. */
function viewAt(rotation: Rotation, scroll: Scroll, viewport: Size, frameDrawn?: SurfaceViewInput['frameDrawing']): SurfaceView {
  const weave = canvasWeave.value
  return surfaceView({ space: space.value, technique: weave.technique, techniqueSettings: weave.techniqueSettings, cell: weave.cell, frame: placedFrame(props.project), rotation, zoom: props.zoom, scroll, viewport, frameDrawing: frameDrawn })
}

/** A Project's Frame centre in a view of its Canvas: where the view draws the Frame's middle (ticket 1188). */
function frameCentreIn(project: Project, view: SurfaceView): Scroll {
  const centre = frameCentreOnCanvas(project)!
  return view.gridToPoint(centre.x * CELL_SIZE_PX, centre.y * CELL_SIZE_PX)
}

/** The Frame's drawing (ticket 1187): leaning by its own angle, its sheet drawn at its own nearest quarter turn, and
 * pinned where it lies on the table, so a turn of the Canvas never moves it (ticket 1188). While it lies as the Canvas
 * is drawn, the Canvas's very drawing. */
const frameDrawn = computed<LayerDrawing>(() => {
  const frame = frameOf(props.project)
  const canvas = canvasDrawn.value
  if (!frame) return canvas
  const angle = frameAngleOf(props.project)
  const rotation = normalizedOrientation(nearestQuarterTurn(angle) - 90 * (frame.quarterTurns ?? 0)) as Rotation
  const moved = props.twistMoved && (props.twistMoved.x !== 0 || props.twistMoved.y !== 0)
  return frameDrawing({
    screen: size.value,
    angle,
    rotation,
    canvas,
    own: !!frame.centre || !!moved,
    // Its centre shows where it lies on the table, and its drawing is pinned there.
    pin: () => ({
      displayed: frameCentreIn(withFrameLaidAt(props.project, rotation), viewAt(rotation, { x: 0, y: 0 }, size.value)),
      onScreen: canvas.leaning.toScreen(frameCentreIn(shownProject.value, viewAt(canvas.rotation, canvas.scroll, canvas.leaning.drawn))),
    }),
  })
})
/** Whether the Frame is drawn as the Canvas is: one drawing, one view, as while the Canvas carries it. */
const drawnAlike = computed(() => frameDrawn.value === canvasDrawn.value)

/** How a bead and a point of the viewport map onto each other: built once, so the pointer and the Frame's handles
 * agree with what is drawn. Its points are the Canvas drawing's; the Frame layer lies in it by its own transform. */
const surface = computed(() => {
  const canvas = canvasDrawn.value
  const frame = frameDrawn.value
  // Its margin sheet, as its own surface draws it, takes no press whatever lies under it (ticket 1188).
  const sheet = drawnAlike.value ? undefined : marginSheetPx(withFrameLaidAt(props.project, frame.rotation))?.sheet
  return viewAt(canvas.rotation, canvas.scroll, canvas.leaning.drawn, drawnAlike.value ? undefined : { rotation: frame.rotation, scroll: frame.scroll, seam: seamOf(frame.leaning, canvas.leaning), sheet })
})
/** The view the Frame's own surface is drawn through: its drawing's points. */
const frameSurface = computed(() => (drawnAlike.value ? surface.value : viewAt(frameDrawn.value.rotation, frameDrawn.value.scroll, frameDrawn.value.leaning.drawn)))
const frameLeaning = computed(() => frameDrawn.value.leaning)
/** The Project as the Frame's own surface draws it: its Frame on the grid of a Canvas at that surface's quarter turn,
 * which its margin sheet, rulers and title block are laid out on (ticket 1188). */
const frameProject = computed(() => withFrameLaidAt(props.project, frameDrawn.value.rotation))

/** The Pieces the rulers hang from: counted once per edit, and held through a stroke, growing only where it paints,
 * until it ends (ticket 0674). */
const pieces = computed<RuledPieces>((previous) =>
  ruledPieces(previous, props.project, { numbers: props.showRulers ?? true, stroking: props.stroking ?? false, idleWalk: (beads, weave, anchors) => piecesWhenIdle('rulers', beads, weave, anchors) }),
)

/** The numbers' size: 11px, 12px on a phone (Rulers card). */
function rulerFontPx(): number {
  return rulerFontAtFull(window.innerWidth <= 743)
}

/** The form and scale the Frame's margin sheet takes at this zoom (tickets 0658, 0698): the Frame's numbers hang on it. */
const sheetLook = computed(() => {
  const band = (marginSheetPx(frameProject.value)?.band ?? 0) * props.zoom
  const least = theme.value.margin.leastScale
  return band ? { sheet: marginForm(band, least), sheetScale: marginScale(band, least) } : {}
})

/** The rulers of a view, laid out once: the overlay draws them and a press asks them what it selects, so the two
 * cannot disagree. */
const rulersIn = (view: SurfaceView, project: Project = props.project) => rulerLayout(project, view, { fontPx: rulerFontPx(), numbers: props.showRulers ?? true, ...sheetLook.value, expanded: !!props.slim, pieces: pieces.value })
const rulers = computed(() => rulersIn(surface.value))
/** The Frame's rulers lie on its own surface (ticket 1187), laid out in its drawing's view. */
const frameRulers = computed(() => (drawnAlike.value ? rulers.value : rulersIn(frameSurface.value, frameProject.value)))

/** A drawing as one layer's surface made it: the view it was drawn for, and how it maps to the screen. */
interface HeldDrawing {
  project: Project
  zoom: number
  scroll: Scroll
  size: Size
  leaning: TiltedView
  surface: SurfaceView
  rulers: RulerLayout
}
/** What each surface was last drawn for while two fingers twist the Canvas. */
interface HeldDrawings {
  canvas: HeldDrawing
  frame: HeldDrawing
}
/** Each surface's live drawing: what it draws now, outside a twist. */
const liveCanvas = (): HeldDrawing => ({ project: drawnProject.value, zoom: props.zoom, scroll: drawnScroll.value, size: drawnSize.value, leaning: leaning.value, surface: surface.value, rulers: rulers.value })
const liveFrame = (): HeldDrawing => {
  if (drawnAlike.value) return { ...liveCanvas(), rulers: frameRulers.value }
  const frame = frameDrawn.value
  return { project: frameProject.value, zoom: props.zoom, scroll: frame.scroll, size: frame.leaning.drawn, leaning: frame.leaning, surface: frameSurface.value, rulers: frameRulers.value }
}
// While two fingers twist the Canvas (ticket 0709) the layers keep the view they last drew, each surface laid where
// the live view shows its beads by its own transform (ticket 1187). They draw afresh when the fingers lift (easing onto
// a quarter turn first) and, so a long hold is sharp, after a pause with them still.
const held = shallowRef<HeldDrawings>()
let holdTimer: ReturnType<typeof setTimeout> | undefined
function hold(): void {
  held.value = { canvas: liveCanvas(), frame: liveFrame() }
}
watch(() => props.twist, (phase) => {
  clearTimeout(holdTimer)
  if (!phase) held.value = undefined
  else if (!held.value) hold()
})
watch([() => props.orientation, () => props.zoom, () => props.scroll], () => {
  if (props.twist !== 'turning') return
  clearTimeout(holdTimer)
  holdTimer = setTimeout(hold, SETTLE_MS)
})
onBeforeUnmount(() => clearTimeout(holdTimer))
/** One surface as its layers draw it: the held drawing's while the Canvas is twisted, else the live one. */
function layerOfSurface(which: keyof HeldDrawings, live: () => HeldDrawing) {
  const drawing = computed(() => held.value?.[which] ?? live())
  return {
    drawing,
    props: viewProps({ get project() { return drawing.value.project }, get zoom() { return drawing.value.zoom }, get scroll() { return drawing.value.scroll } }),
    size: computed(() => drawing.value.size),
    surface: computed(() => drawing.value.surface),
    rulers: computed(() => drawing.value.rulers),
  }
}
const canvasLayer = layerOfSurface('canvas', liveCanvas)
const frameLayer = layerOfSurface('frame', liveFrame)
const layerSize = canvasLayer.size
const layerSurface = canvasLayer.surface

/** A surface's box: the screen, or the larger square it fills while it leans, turned about the surface's middle; a held
 * drawing's box as it was made, laid where the view shows it, eased there as the twist settles. */
function surfaceStyle(holding: HeldDrawing | undefined, live: { surface: SurfaceView; leaning: TiltedView }) {
  /** The box a drawing was made on, placed where it lies before it is turned. */
  const box = ({ drawn, offset }: TiltedView) => ({ left: `${-offset.x}px`, top: `${-offset.y}px`, width: `${drawn.width}px`, height: `${drawn.height}px` })
  if (holding) {
    const { a, b, c, d, e, f } = twistTransform(holding, live)
    return {
      ...box(holding.leaning),
      transformOrigin: '0 0', transform: `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`, willChange: 'transform',
      ...(props.twist === 'settling' ? { transition: 'transform var(--duration-base) var(--ease-out)' } : {}),
    }
  }
  const { degrees } = live.leaning
  if (degrees === 0) return undefined
  return { ...box(live.leaning), transform: `rotate(${degrees}deg)` }
}
const drawingStyle = computed(() => surfaceStyle(held.value?.canvas, { surface: surface.value, leaning: leaning.value }))
const frameDrawingStyle = computed(() => surfaceStyle(held.value?.frame, { surface: frameSurface.value, leaning: frameLeaning.value }))

/** Where the Selection is on screen, told to the Selection bar (ticket 415). */
watch(
  [surface, () => props.selection, size],
  () => {
    const selected = props.selection
    if (!selected || size.value.width === 0) {
      emit('selection-anchor', undefined)
      return
    }
    // The Selection bar stands upright over the box the Selection covers on screen, leaning or not.
    const box = leaning.value.screenBox(surface.value.beadBox(selectionFrame(selected), selectionLayer(props.project, selected)))
    emit('selection-anchor', { box: { left: box.x, top: box.y, width: box.width, height: box.height }, viewport: { ...size.value } })
  },
  { immediate: true, flush: 'post' },
)

/** Where the Mirror's Area is on screen, told to the Mirror bar (ContextBar card): a Canvas Area's box, or the whole
 * Frame's margin sheet (its Frame where no sheet is drawn). */
watch(
  [surface, frameSurface, () => props.mirror?.place, size],
  () => {
    const place = props.mirror?.place
    const frame = frameOf(props.project)
    if (!place || size.value.width === 0 || (place.layer === 'frame' && !frame)) {
      emit('mirror-anchor', undefined)
      return
    }
    const box = place.layer === 'canvas' ? leaning.value.screenBox(surface.value.beadBox(place.area, 'canvas')) : frameLeaning.value.screenBox(sheetIn(frameSurface.value) ?? frameSurface.value.frameBox(frame!))
    emit('mirror-anchor', { box: { left: box.x, top: box.y, width: box.width, height: box.height }, viewport: { ...size.value } })
  },
  { immediate: true, flush: 'post' },
)

/** The expanded Frame's slim sheet in the view's px (ticket 1169): round the Frame's line by what it holds. */
const slimBox = computed(() => {
  const frame = frameOf(props.project)
  if (!props.slim || !frame) return undefined
  const line = frameSurface.value.frameBox(frame)
  const sides = slimSheetSides(props.slim, line.width)
  return { x: line.x - sides.left, y: line.y - sides.top, width: line.width + sides.left + sides.right, height: line.height + sides.top + sides.bottom }
})
/** The slim sheet as the canvas draws it: its box in grid px, its corners in screen px. */
const slimSheet = computed<SlimSheet | undefined>(() => {
  const box = slimBox.value
  if (!box || !props.slim) return undefined
  const corners = [frameSurface.value.pointToGrid({ x: box.x, y: box.y }), frameSurface.value.pointToGrid({ x: box.x + box.width, y: box.y + box.height })]
  const x = Math.min(corners[0]!.x, corners[1]!.x)
  const y = Math.min(corners[0]!.y, corners[1]!.y)
  const sheet = { x, y, width: Math.abs(corners[1]!.x - corners[0]!.x), height: Math.abs(corners[1]!.y - corners[0]!.y) }
  return { sheet, radius: props.slim.compact ? MARGIN_PX.sheetRadius.compact : MARGIN_PX.sheetRadius.full }
})

/** The Frame's margin sheet in a view's px, the drawing's before it leans; none without a Frame. Expanded, the slim
 * sheet. */
function sheetIn(view: SurfaceView): { x: number; y: number; width: number; height: number } | undefined {
  if (slimBox.value && view === frameSurface.value) return slimBox.value
  const grid = marginSheetPx(frameProject.value)
  if (!grid) return undefined
  const corners = [view.gridToPoint(grid.sheet.x, grid.sheet.y), view.gridToPoint(grid.sheet.x + grid.sheet.width, grid.sheet.y + grid.sheet.height)]
  return {
    x: Math.min(corners[0].x, corners[1].x),
    y: Math.min(corners[0].y, corners[1].y),
    width: Math.abs(corners[1].x - corners[0].x),
    height: Math.abs(corners[1].y - corners[0].y),
  }
}

/** Where the Frame and its margin sheet are on screen, none once the sheet is out of view (tickets 417, 473, 0657):
 * told to the sheet's tools and title block. */
const frameAnchor = computed<FrameAnchor | undefined>(() => {
  const frame = frameOf(props.project)
  const grid = marginSheetPx(frameProject.value)
  if (!frame || !grid || size.value.width === 0) return undefined
  const drawnSheet = sheetIn(frameSurface.value)!
  // Scrolled wholly out of view, the sheet has no tools to keep on screen.
  const seen = frameLeaning.value.screenBox(drawnSheet)
  const { width, height } = size.value
  if (seen.x + seen.width <= 0 || seen.y + seen.height <= 0 || seen.x >= width || seen.y >= height) return undefined
  // The sheet's tools are laid out as the Frame's drawing is, before it leans, and lean with it (`tilt`): the margin
  // sheet's tilt is the Frame's (ticket 1187).
  const { offset, degrees } = frameLeaning.value
  const unleaned = ({ x, y, width, height }: { x: number; y: number; width: number; height: number }) => ({ left: x - offset.x, top: y - offset.y, width, height })
  return {
    box: unleaned(frameSurface.value.frameBox(frame)),
    sheet: unleaned(drawnSheet),
    band: grid.band * props.zoom,
    viewport: { ...size.value },
    origin: unleaned(frameSurface.value.beadBox({ row: 0, column: 0, rows: 1, columns: 1 }, 'canvas')),
    ...(degrees === 0 ? {} : { tilt: degrees }),
  }
})
watch(frameAnchor, (anchor) => emit('frame-anchor', anchor), { immediate: true, flush: 'post' })

/** The clear px between a Piece's tag and the column numbers under it. */
const TAG_NUMBER_CLEARANCE = 2

/** Where each unframed Schema is on screen (ticket 0721), from the named Pieces the rulers hold through a stroke: told
 * to their tags. */
const schemaAnchors = computed<SchemaAnchors | undefined>(() => {
  if (size.value.width === 0) return undefined
  const { scale } = rulers.value
  const outset = scale.pieceOutset
  const lift = scale.gap + scale.fontPx + TAG_NUMBER_CLEARANCE
  const schemas = unframedSchemas(props.project, pieces.value.named).map(({ name, anchor, row, column, rows, columns }) => {
    const piece = { row, column, rows, columns }
    const shown = leaning.value.screenBox(surface.value.beadBox(piece, 'canvas'))
    return { name, anchor, piece, box: { left: shown.x - outset, top: shown.y - outset, width: shown.width + 2 * outset, height: shown.height + 2 * outset } }
  })
  return { schemas, viewport: { ...size.value }, lift }
})
watch(schemaAnchors, (anchors) => emit('schema-anchors', anchors), { immediate: true, flush: 'post' })

/** Row marks are drawn unless the Row highlight toggle is off; the project's own Row progress decides the rest. */
const marksShown = computed(() => props.rowMarks && rowProgressOn(props.project))

const marginCue = useMarginCue(props)
const pickChipEl = useTemplateRef<HTMLElement>('pickChipBox')
/** The Frame's own surface, where it is drawn otherwise than the Canvas: its handles are pressed there (ticket 1188). */
const frameView = computed(() => (drawnAlike.value ? undefined : { surface: frameSurface.value, leaning: frameLeaning.value, rotation: frameDrawn.value.rotation }))
const pointer = useSurfacePointer({ props: drawnProps, emit, root: rootEl, pickChipEl, size, surface, leaning, frameView, marksShown, refuse: marginCue.refuse })
const { handlers, surfaceClass, cursorStyle, penPointer, pickChip, pressMoveHandle, pressAreaGrip, opensToolbox } = pointer
const { t } = useI18n()
const beadColors = useBeadColorsList()
const palette = computed(() => projectPalette(props.project))
/** The Palette color of the bead under the eyedropper, named by its code and color as the Palette names it. */
const pickedColor = computed(() => (pickChip.value ? palette.value.byHex(pickChip.value.hex) : undefined))
loadCatalogWhen(beadColors, () => !!pickedColor.value?.code)
/** The chip's text: the bead color's code where the Palette holds it with one, else only its hex. */
const pickChipText = computed(() => {
  const color = pickedColor.value
  return color?.code ? colorLabel(t.value, color, beadColors?.catalog.value).text : pickChip.value?.hex
})
const { oncePerFrame } = useFrameScheduler()
// The Row motion's fade and Rotate Frame's turn copy the Frame's own surface (ticket 1187).
const rowMotion = useRowMotion({ props, beads: frameBaseEl, fade: fadeEl, view: () => [props.zoom, props.scroll, frameLayer.size.value, props.twist] })
const frameTurn = useFrameTurn({
  turns: () => props.frameTurns,
  beads: frameBaseEl,
  copy: turnEl,
  frameBox: () => {
    const frame = frameOf(props.project)
    return frame && frameLayer.surface.value.frameBox(frame)
  },
  paper: () => theme.value.margin.fill,
  view: () => [props.zoom, props.scroll, frameLayer.size.value, props.twist],
})
/** Finished passes show at full color while hovered or pressed, and once every pass is done (ticket 0730). */
const showFinished = computed(() => pointer.showFinished.value || rowMotion.finishedRestored.value)
const reference = toRef(() => props.reference)
useBeadLayer({ layer: 'canvas', props: canvasLayer.props, canvas: baseEl, standIn: standInEl, size: layerSize, space, theme, frameTheme, showFinished, marksShown, oncePerFrame, reference, slimSheet })
// The Frame's surface is drawn after the Canvas's, in the same frame: once it is, every bead in view is.
useBeadLayer({ layer: 'frame', props: frameLayer.props, canvas: frameBaseEl, standIn: frameStandInEl, size: frameLayer.size, space, theme, frameTheme, showFinished, marksShown, oncePerFrame, onDrawn: () => emit('drawn'), reference, slimSheet })
useCarryLayer({ props: canvasLayer.props, canvas: carryEl, size: layerSize, space, surface: layerSurface, theme, frameTheme, carried: () => props.carriedPiece, oncePerFrame })
watch(layerSurface, (view) => emit('surface-view', view), { immediate: true, flush: 'post' })
/** What both overlays follow from the pointer and the motions. */
const overlayDeps = {
  space, theme, frameTheme, marksShown, oncePerFrame,
  markerAt: pointer.markerAt, framing: pointer.framing, touchInput: pointer.touchInput, hotHandle: pointer.hotHandle, hotAreaHandle: pointer.hotAreaHandle, marginOpacity: marginCue.opacity,
  rowMotion: rowMotion.rowMotion,
}
useSurfaceOverlay({ ...overlayDeps, layer: 'canvas', props: canvasLayer.props, canvas: canvasOverlayEl, size: layerSize, surface: layerSurface, rulers: canvasLayer.rulers })
useSurfaceOverlay({ ...overlayDeps, layer: 'frame', props: frameLayer.props, canvas: overlayEl, size: frameLayer.size, surface: frameLayer.surface, rulers: frameLayer.rulers })

/** Where Pattern done plays (ticket 0730): the margin sheet, the Frame in it and the beads its stars light, in the
 * drawing's px, as the layers draw it. */
const patternDoneAt = computed(() => {
  const frame = frameOf(props.project)
  const view = frameLayer.surface.value
  const sheet = sheetIn(view)
  if (!frame || !sheet || rowMotion.patternDone.value === undefined) return undefined
  const box = view.frameBox(frame)
  const stars = PATTERN_DONE_STARS.map(({ across, down }) => {
    const at = view.beadToPoint({ row: frame.row + Math.round(down * (frame.rows - 1)), column: frame.column + Math.round(across * (frame.columns - 1)) }, 'frame')
    return { x: at.x - sheet.x, y: at.y - sheet.y }
  })
  return { id: rowMotion.patternDone.value, sheet, frame: { ...box, x: box.x - sheet.x, y: box.y - sheet.y }, stars }
})

/** The empty Canvas laid under the drawing, at the view the beads are drawn at (ticket 0717). */
const emptyCanvasStyle = useEmptyCanvasLook({ props: canvasLayer.props, surface: layerSurface, size: layerSize, theme, root: rootEl })

// Tests read what was drawn from the layout the surface built.
/** Where a bead's middle is on screen, in client pixels: the Homepage's tour points its ghost there (ticket 0797). */
function beadOnScreen(position: GridPosition): { x: number; y: number } | undefined {
  const box = rootEl.value?.getBoundingClientRect()
  if (!box) return undefined
  const layer = layerAt(props.project, position)
  const [view, lean] = layer === 'frame' ? [frameSurface.value, frameLeaning.value] : [surface.value, leaning.value]
  const bead = view.beadBox({ row: position.row, column: position.column, rows: 1, columns: 1 }, layer)
  const shown = lean.toScreen({ x: bead.x + bead.width / 2, y: bead.y + bead.height / 2 })
  const zoom = cssZoomOf(rootEl.value)
  return { x: box.left + shown.x * zoom, y: box.top + shown.y * zoom }
}

defineExpose({ rulerLayout: rulers, pressMoveHandle, pressAreaGrip, beadOnScreen, opensToolbox })

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(rootEl.value)
  }
  window.addEventListener('resize', measure, { passive: true })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measure)
})
</script>

<template>
  <div
    ref="rootEl"
    class="project-surface"
    data-testid="project-surface"
    :data-technique="canvasWeave.technique"
    :data-technique-settings="JSON.stringify(canvasWeave.techniqueSettings ?? {})"
    :data-rotation="quarterTurn"
    :data-tilt="leaning.degrees || undefined"
    :data-zoom="zoom"
    :data-scroll-x="scroll.x"
    :data-scroll-y="scroll.y"
    :class="surfaceClass"
    :style="cursorStyle"
    role="img"
    :aria-label="label"
    @pointerdown.capture="handlers.onPress"
    @pointerdown="handlers.onPointerDown"
    @pointermove="handlers.onPointerMove"
    @pointerup="handlers.onPointerEnd"
    @pointercancel="handlers.onPointerCancel"
    @lostpointercapture="handlers.onPointerEnd"
    @pointerleave="handlers.onPointerLeave"
    @wheel="handlers.onWheel"
    @contextmenu.prevent
  >
    <!-- The Canvas's surface (ticket 1187): its beads and its own items, leaning on its own. -->
    <div class="project-surface__drawing" :style="[drawingStyle, emptyCanvasStyle]" data-testid="project-surface-canvas-layer">
      <!-- What a long pan uncovers, in the draft look, till the beads are drawn sharp (ticket 0732). -->
      <canvas ref="standInEl" class="project-surface__canvas" style="visibility: hidden" data-testid="project-surface-stand-in" aria-hidden="true" />
      <canvas ref="baseEl" class="project-surface__canvas" data-testid="project-surface-cells" />
      <!-- A Piece carried by its move grip, laid where the pointer has brought it (ticket 1151). -->
      <canvas ref="carryEl" class="project-surface__canvas" style="display: none" data-testid="project-surface-carry" aria-hidden="true" />
      <canvas ref="canvasOverlayEl" class="project-surface__canvas" data-testid="project-surface-canvas-overlay" aria-hidden="true" />
    </div>
    <!-- The Frame's surface over it (ticket 1187): its margin sheet, beads, Row progress, rulers and handles, leaning on
         its own. Clear round its sheet. -->
    <div class="project-surface__drawing" :style="frameDrawingStyle" data-testid="project-surface-frame-layer">
      <canvas ref="frameStandInEl" class="project-surface__canvas" style="visibility: hidden" data-testid="project-surface-frame-stand-in" aria-hidden="true" />
      <canvas ref="frameBaseEl" class="project-surface__canvas" data-testid="project-surface-frame-cells" aria-hidden="true" />
      <!-- The finished passes as they were dimmed, fading out as Pattern done brings them back (ticket 0730). -->
      <canvas v-show="rowMotion.fadeOpacity.value > 0" ref="fadeEl" class="project-surface__canvas" :style="{ opacity: rowMotion.fadeOpacity.value }" aria-hidden="true" />
      <!-- The Frame as it was, turning a quarter over the Frame drawn turned (ticket 1016). -->
      <canvas v-show="frameTurn.turning.value" ref="turnEl" class="project-surface__canvas" data-testid="project-surface-turn" aria-hidden="true" />
      <canvas ref="overlayEl" class="project-surface__canvas" data-testid="project-surface-overlay" />
      <PatternDone v-if="patternDoneAt" :key="patternDoneAt.id" :sheet="patternDoneAt.sheet" :frame="patternDoneAt.frame" :stars="patternDoneAt.stars" />
    </div>
    <img
      v-if="penPointer"
      class="project-surface__pen-pointer"
      :src="penPointer.url"
      :style="{ left: `${penPointer.x}px`, top: `${penPointer.y}px` }"
      data-testid="pen-pointer"
      alt=""
      aria-hidden="true"
    />
    <span
      v-if="pickChip"
      ref="pickChipBox"
      class="project-surface__pick-chip"
      :class="{ 'project-surface__pick-chip--flip-x': pickChip.flipX, 'project-surface__pick-chip--flip-y': pickChip.flipY }"
      :style="{ left: `${pickChip.x}px`, top: `${pickChip.y}px`, '--pick-color': pickChip.hex }"
      data-testid="pick-chip"
      aria-hidden="true"
    ><span class="project-surface__pick-chip-swatch" />{{ pickChipText }}</span>
  </div>
</template>

<style scoped>
.project-surface {
  position: absolute;
  inset: 0;
  /* Clip, not hidden: a hidden box can still be scrolled, which slid the drawing away from its overlays (ticket 1107). */
  overflow: hidden;
  overflow: clip;
  /* Without this (ticket 60), the browser may treat a touch/pen drag as scroll/pan instead of delivering
   * pointermove. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

/* Over the canvas's beads the OS pointer is hidden: the overlay draws a bead-shaped marker in its place (BeadHover
 * card, ticket 353). */
.project-surface--over-bead {
  cursor: none;
}

/* Over the Frame's margin with a tool that cannot place beads there (Frame card, ticket 276); it wins over the bead
 * marker. */
.project-surface--refused {
  cursor: not-allowed;
}

/* The Hand tool and Space + drag (CanvasHint card): an open hand, closed while the canvas is being moved. */
.project-surface--moving {
  cursor: grab;
}

/* The live color under the eyedropper: a small chip a little below and right of the tip, never in the way of the
 * press. */
.project-surface__pen-pointer {
  position: absolute;
  pointer-events: none;
}

.project-surface__pick-chip {
  position: absolute;
  display: flex;
  align-items: center;
  gap: var(--space-6);
  transform: translate(var(--space-16), var(--space-16));
  padding: var(--space-4) var(--space-8) var(--space-4) var(--space-4);
  color: var(--ink);
  font: var(--text-meta-small);
  background: var(--panel);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
  white-space: nowrap;
  pointer-events: none;
}

.project-surface__pick-chip--flip-x {
  transform: translate(calc(-100% - var(--space-16)), var(--space-16));
}

.project-surface__pick-chip--flip-y {
  transform: translate(var(--space-16), calc(-100% - var(--space-16)));
}

.project-surface__pick-chip--flip-x.project-surface__pick-chip--flip-y {
  transform: translate(calc(-100% - var(--space-16)), calc(-100% - var(--space-16)));
}

.project-surface__pick-chip-swatch {
  width: var(--space-16);
  height: var(--space-16);
  background: var(--pick-color);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.project-surface--dragging {
  cursor: grabbing;
}

/* The canvases' box: the surface itself, or, while the Canvas leans off a quarter turn, a larger square turned about
 * its middle (ticket 0672). */
.project-surface__drawing {
  position: absolute;
  inset: 0;
}

/* The empty Canvas under the drawing (ticket 0717): the Position marks' tile repeated at the view's zoom, scroll and
 * quarter turn, reaching past the box so a twist that moves it still covers the surface. The drawing hides it. */
.project-surface__drawing::before {
  position: absolute;
  inset: calc(-1 * var(--empty-reach, 0px));
  background: var(--empty-marks, none) var(--empty-marks-at, 0 0) / var(--empty-marks-size, auto) repeat var(--empty-gap, transparent);
  content: '';
  pointer-events: none;
}

.project-surface__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
</style>
