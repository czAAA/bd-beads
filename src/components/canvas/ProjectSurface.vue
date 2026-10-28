<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { changedPositions } from '../../domain/canvas'
import { layerAt } from '../../domain/layers'
import { footprintOf } from '../../domain/footprint'
import { frameAllows } from '../../domain/frameKind'
import { inMargin, mayPlace } from '../../domain/margin'
import type { Tool } from '../../domain/tool'
import type { GridPosition, Layer, PreviewCell } from '../../domain/grid'
import { pointerDraws, type Handedness, type InputMode } from '../../domain/inputMode'
import { beadColorAt, canvasWeave, isInFinishedRow, projectCell, rowProgressOn, sameWeave, shownLetters, type Project } from '../../domain/project'
import { selectionFrame, selectionHasHandles, selectionLayer, type Selection } from '../../domain/selection'
import type { ProjectTheme } from '../../rendering/beadLook'
import { boxPressAt, frameHandleIdAt, framePressAt, handleIdAt, HANDLE_CURSORS, pointInBox, type FramePress } from '../../rendering/frameHandles'
import { beadsToDraw, gestureTransform, SETTLE_MS, GESTURE_BEAD_LIMIT } from '../../rendering/gestureView'
import { renderOverlay } from '../../rendering/overlayRenderer'
import { renderProject } from '../../rendering/projectRenderer'
import { rulerLayout } from '../../rendering/rulers'
import { spaceOf } from '../../rendering/space'
import type { FrameAnchor, SelectionAnchor } from '../../composables/tools/selectionBarPlacement'
import { edgeScrollStep } from '../../composables/canvas/edgeScroll'
import { surfaceView, type Scroll, type ViewLayer } from '../../rendering/surfaceView'
import { EYEDROPPER_CURSOR, EYEDROPPER_IMAGE } from './eyedropperCursor'
import { toolPointer, toolPointerImage } from './toolCursors'
import { useCanvasBackground } from '../../theme/useCanvasBackground'

// The Canvas drawn by the Project renderer (ADR 0018, ADR 0026), the Drawing surface of CONTEXT.md: two screen-sized
// canvases (beads and dots; overlay: see overlayRenderer), no board; `scroll` and `zoom` decide what shows.
// It reads the view gestures (wheel, Ctrl/Cmd + wheel, Hand tool or middle drag) and reports them to useCanvasView.
const props = withDefaults(defineProps<{
  project: Project
  /** How much the canvas is enlarged by; 1 is a bead 20 px across. */
  zoom: number
  /** Where the viewport's top-left corner is, in displayed px from the bead at row 0, column 0 (see the Surface
   * view). */
  scroll: Scroll
  /** Beads to show a hover preview on (ticket 23): the hovered bead, or a whole
   * copied block under the cursor (ticket 31). */
  previewCells?: PreviewCell[]
  /** The color to preview, faintly, on beads that carry none of their own; null for a neutral outline when no
   * Palette color is selected. */
  previewColor?: string | null
  /** The rectangle the Select tool has marked out, drawn as a marquee over those beads (ticket 31). */
  selection?: Selection
  /** The Project's accessible name: it is one image to a screen reader, summed up (ScreenReaders card). */
  label?: string
  /** Whether a drag moves the canvas instead of drawing (the Hand tool, or Space held); Edit Frame takes the drag
   * over it, so the Frame can be edited whichever Tool was chosen. */
  moving?: boolean
  /** Which pointer draws and which one moves the canvas (ticket 325); absent, every pointer draws. */
  inputMode?: InputMode
  /** Which hand holds the pen: its marker stands off the tip away from that hand. Right when not given. */
  handedness?: Handedness
  /** Whether ruler numbers are drawn (the Rulers toggle); the lines they hang from are drawn either way. */
  showRulers?: boolean
  /** Whether the Row progress look is drawn (ticket 474): finished rows dimmed, the current row ringed and lifted. */
  rowMarks?: boolean
  /** Whether the Frame is being edited (Edit Frame, ticket 417): a drag moves or resizes it instead of drawing
   * beads, and its handles, margin outline and size tooltip show. */
  settingFrame?: boolean
  /** The size tooltip's text at the Frame's corner while it is being set ("13×13 ≈ 2.1 × 2.1 cm"). */
  frameTooltip?: string
  /** Whether the bead-shaped pointer is held back although the pointer is over the beads: Space is down, so the grab
   * cursor shows (ticket 353). */
  markerHidden?: boolean
  /** Whether the tool in hand cannot place beads in the Frame's margin (Paint, Fill, a Paste): the pointer shows
   * `not-allowed` there, and a press there is refused (ticket 276). */
  blocksMargin?: boolean
  /** Whether the Select tool is in hand: the margin cannot be selected, so a press starting there is refused with
   * `not-allowed` and starts no Selection (ticket 428, ADR 0051). */
  selectionBlocksMargin?: boolean
  /** How many Selections have been refused off the pointer (a Shift+arrow into the margin, a Piece tap there, ticket
   * 433): each one shows the not-allowed cue, the margin outline for 1s. */
  selectionRefusals?: number
  /** Whether Select or Piece is the tool in hand (ticket 414): the pointer is the native arrow, not the bead-shaped
   * marker, and the Selection shows its handles. */
  selecting?: boolean
  /** The tool in hand (ticket 542): its Tool pointer is the canvas pointer, in place of the bead-shaped marker. Absent,
   * the marker shows over the beads. */
  tool?: Tool
  /** Whether Pick color from canvas is on (ticket 403): the pointer is an eyedropper, the paint preview and bead
   * marker give way, and a chip by the pointer shows the color of the bead under it. */
  picking?: boolean
  /** Whether a press off a bead lands on the nearest bead instead of opening a stroke (Fill, ticket 504). */
  nearestOnPress?: boolean
  /** Select is the tool (ticket 505): a press and a drag are read at the nearest bead position wherever the pointer is. */
  selectAnywhere?: boolean
}>(), { rowMarks: true })

const emit = defineEmits<{
  'cell-primary-down': [row: number, column: number, layer?: Layer]
  'cell-primary-move': [row: number, column: number, layer?: Layer]
  'cell-hover': [row: number, column: number, layer?: Layer]
  'hover-end': []
  /** The canvas was dragged by this many px (the Hand tool, the middle button). */
  pan: [dx: number, dy: number]
  /** The wheel or a trackpad scrolled the canvas by this many px. */
  scroll: [dx: number, dy: number]
  /** Ctrl/⌘ + wheel (or a trackpad pinch) asked to change the zoom by this factor about a point of the viewport. */
  'zoom-by': [factor: number, anchor: Scroll]
  /** Edit Frame: a press grabbed a handle, the inside of the Frame or the Canvas, at this bead position. */
  'frame-press': [target: FramePress, cell: GridPosition]
  /** Edit Frame: the pointer moved with the press held, over this bead position. */
  'frame-drag': [cell: GridPosition]
  /** Edit Frame: the press ended. */
  'frame-release': []
  /** The Selection's handles or inside were pressed (ticket 414), at this bead position. */
  'selection-press': [target: FramePress, cell: GridPosition]
  /** The pointer moved with that press held, over this bead position. */
  'selection-drag': [cell: GridPosition]
  /** That press ended. */
  'selection-release': []
  /** Edit Frame: a second finger landed, so the press was a pinch, not a drag: drop what was dragged. */
  'frame-cancel': []
  /** The Selection's rectangle in the surface's pixels (ticket 415), or none: where the Selection bar anchors.
   * Follows pan and zoom. */
  'selection-anchor': [anchor: SelectionAnchor | undefined]
  /** The Frame's rectangle in the surface's pixels (tickets 417, 473), or none once it is out of view: where the Move
   * handle and the edit pencil sit in its gutter. */
  'frame-anchor': [anchor: FrameAnchor | undefined]
  /** Whether a pointer is down on the surface (a gesture, pan or pinch is running): the Selection bar steps aside
   * meanwhile. */
  pressing: [pressing: boolean]
}>()

/** Whether the chosen Tool moves the canvas right now: the Hand tool. */
const handMoves = computed(() => props.moving === true)
/** Whether the pointer is the eyedropper (ticket 403): picking, unless the canvas is being moved (Hand, Space). */
const eyedropperShown = computed(() => props.picking === true && !props.markerHidden && !handMoves.value)

/** The tool's own pointer (ticket 542): not while the eyedropper, Space or a canvas move by another button
 * (the system's grab and grabbing) or the Frame's margin (not-allowed) has the pointer. Hand closes its hand while it
 * pans. */
const toolCursor = computed(() => {
  if (!props.tool || props.picking || props.markerHidden || overRefusedMargin.value) return undefined
  if (dragging.value && !handMoves.value) return undefined
  return toolPointer(props.tool, { color: props.previewColor, dragging: dragging.value })
})

/** Where a Pencil hovers (ticket 546), in client px, and whether it is the pointer that moves the canvas in the input
 * mode. None for a mouse, a finger or a Pencil in contact. */
const penAt = ref<{ clientX: number; clientY: number; moves: boolean }>()

/** How far up and left of the tip the hovering Pencil's pointer is drawn, in px, so the Pencil's own tip does not
 * cover the hot spot. */
const PEN_POINTER_NUDGE = 2

/** The Tool pointer the app draws for a hovering Pencil, which Safari shows no CSS cursor for: the image placed so
 * its hot spot is at the tip, nudged `PEN_POINTER_NUDGE` up and left. Not where the CSS cursor is not the tool's (Set
 * Frame, a handle, Space) or the tool is refused (the Frame's margin, also when the canvas moves under a still Pencil). */
const penPointer = computed(() => {
  if (!penAt.value || props.settingFrame || props.markerHidden || handleCursor.value || refusesMargin(beadUnder(penAt.value))) return undefined
  // The pointer that moves the canvas in the input mode shows the Hand, whatever the tool; the others their own.
  const image = penAt.value.moves ? toolPointerImage('hand')
    : eyedropperShown.value ? EYEDROPPER_IMAGE
    : props.tool && !props.picking ? toolPointerImage(props.tool, { color: props.previewColor })
    : undefined
  const point = pointInSurface(penAt.value)
  return image && { url: image.url, x: point.x - image.hotSpot[0] - PEN_POINTER_NUDGE, y: point.y - image.hotSpot[1] - PEN_POINTER_NUDGE }
})

function placePen(event: PointerEvent): void {
  const hovering = event.pointerType === 'pen' && event.buttons === 0 && !dragging.value && !framing.value && !adjusting.value
  penAt.value = hovering ? { clientX: event.clientX, clientY: event.clientY, moves: movesCanvas(event) } : undefined
}

function onPress(event: PointerEvent) {
  const was = activePointers.size > 0
  activePointers.add(event.pointerId)
  if (!was) emit('pressing', true)
}

/** The pointers down on the surface now: the Selection bar returns when the last one lifts (ticket 415). */
const activePointers = new Set<number>()

/** How long after the last wheel event a wheel or trackpad scroll or zoom counts as over, so the bar comes back
 * (ticket 415). */
const WHEEL_IDLE_MS = 150
let wheeling = false
let wheelTimer: ReturnType<typeof setTimeout> | undefined

/** The wheel is a pan or pinch with no press to end it: it holds the bar away until it has been quiet for
 * WHEEL_IDLE_MS. */
function noteWheel() {
  if (!wheeling && activePointers.size === 0) emit('pressing', true)
  wheeling = true
  clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => {
    wheeling = false
    if (activePointers.size === 0) emit('pressing', false)
  }, WHEEL_IDLE_MS)
}

function releasePointer(event?: PointerEvent) {
  if (activePointers.size === 0) return
  if (event) activePointers.delete(event.pointerId)
  else activePointers.clear()
  if (activePointers.size === 0 && !wheeling) emit('pressing', false)
}

/** Capture lost or the window blurred: no pointer is down any more, so the bar must not stay away (ticket 503). */
function dropPressedPointers() {
  releasePointer()
}

/** A press ends wherever its pointer lifts or is cancelled, on the surface or not (a press that starts off the beads
 * or the Selection is not captured): the window hears it, so no path can leave the bar away (ticket 503). */
function onWindowPointerEnd(event: PointerEvent) {
  releasePointer(event)
}

/** The colors the beads are drawn in follow the app's theme and the person's Canvas color; a change redraws both
 * layers. */
const canvasBackground = useCanvasBackground()
const theme = canvasBackground.projectTheme

/** Whether the last pointer was a finger: its Frame handles are the four larger corner ones. */
const touchInput = ref(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)

const rootEl = ref<HTMLElement>()
const baseEl = ref<HTMLCanvasElement>()
const overlayEl = ref<HTMLCanvasElement>()

/** How big the surface is on screen, measured: the canvases are exactly this big. */
const size = ref({ width: 0, height: 0 })
let resizeObserver: ResizeObserver | undefined

function measure(): void {
  const root = rootEl.value
  if (!root) return
  const box = root.getBoundingClientRect()
  const width = Math.round(box.width)
  const height = Math.round(box.height)
  if (width !== size.value.width || height !== size.value.height) {
    size.value = { width, height }
  }
}

/** What the cells were last drawn from, to draw only what an edit changed. */
let drawn: { project: Project; zoom: number; scroll: Scroll; width: number; height: number; pixelRatio: number; theme: ProjectTheme; showFinished: boolean; rowMarks: boolean } | undefined

/** Whether two Projects differ only in the colors of their beads (`updatedAt` is not drawn). Any other difference, even
 * one added later, can change how a bead is drawn (shape, size, Technique, weave), so it repaints it all. */
function sameDrawing(a: Project, b: Project): boolean {
  const { beads: _a, frame: frameA, updatedAt: _u, ...restA } = a
  const { beads: _b, frame: frameB, updatedAt: _v, ...restB } = b
  return sameFields(restA, restB) && (frameA === undefined || frameB === undefined ? frameA === frameB : sameFrameLayout(frameA, frameB))
}

function sameFrameLayout(a: NonNullable<Project['frame']>, b: NonNullable<Project['frame']>): boolean {
  const { beads: _a, ...restA } = a
  const { beads: _b, ...restB } = b
  return sameFields(restA, restB)
}

/** Whether two records hold the same values, comparing objects one level deep (a row progress is replaced whole). */
function sameFields(a: object, b: object): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const field = (record: object, key: string) => (record as Record<string, unknown>)[key]
  return [...keys].every((key) => {
    const x = field(a, key)
    const y = field(b, key)
    if (x === y) {
      return true
    }
    return typeof x === 'object' && typeof y === 'object' && x !== null && y !== null && !Array.isArray(x) && !Array.isArray(y) && Object.keys({ ...x, ...y }).every((inner) => field(x, inner) === field(y, inner))
  })
}

/** Past this many changed rows, drawing them one band at a time costs more than drawing the lot. */
const MOST_ROWS_WORTH_A_BAND = 40

// Bands of rows an edit changed, to draw just those (rows within two apart share a band; neighbours are drawn anyway).
// Empty when nothing changed; undefined when so much did (Undo, Fill) that drawing all again is
// cheaper.
function changedBands(before: Project, after: Project): { first: number; last: number }[] | undefined {
  // The Frame's rows are not the Canvas's where it is woven otherwise (ticket 492): draw it all again.
  if (after.frame && !sameWeave(canvasWeave(after), after.frame) && before.frame?.beads !== after.frame.beads) {
    return undefined
  }
  // The Frame's rows are counted from its first, which is the same in both: the Layout is.
  const framed = (project: Project) => project.frame?.beads ?? {}
  const frameTop = after.frame?.row ?? 0
  const changed = [
    ...new Set([
      ...changedPositions(before.beads, after.beads).map((position) => position.row),
      ...changedPositions(framed(before), framed(after)).map((position) => position.row + frameTop),
    ]),
  ].sort((x, y) => x - y)
  if (changed.length > MOST_ROWS_WORTH_A_BAND) {
    return undefined
  }

  const bands: { first: number; last: number }[] = []
  for (const row of changed) {
    const band = bands.at(-1)
    if (band && row - band.last <= 2) {
      band.last = row
    } else {
      bands.push({ first: row, last: row })
    }
  }
  return bands
}

/** Sizes a canvas to the surface and the screen's pixel density, leaving it alone (and its drawing with it) when it
 * already is. Whether it had to change. */
function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number, pixelRatio: number): boolean {
  const bitmapWidth = Math.max(1, Math.round(width * pixelRatio))
  const bitmapHeight = Math.max(1, Math.round(height * pixelRatio))
  if (canvas.width === bitmapWidth && canvas.height === bitmapHeight) {
    return false
  }
  canvas.width = bitmapWidth
  canvas.height = bitmapHeight
  return true
}

/** The viewport in displayed px: where the canvas has been moved to, and how much of it the surface shows. */
function currentRegion() {
  return { x: props.scroll.x, y: props.scroll.y, width: size.value.width, height: size.value.height }
}

/** Where the Project's positions live: built once and handed to both layers, so they can't disagree about where a
 * position is. */
const space = computed(() => spaceOf(toRaw(props.project), true))

/** How a bead and a point of the viewport map onto each other: built once, so the pointer and the Frame's handles
 * agree with what is drawn. */
const surface = computed(() =>
  surfaceView({ space: space.value, technique: props.project.technique, brickBlock: props.project.brickBlock, netSize: props.project.netSize, cell: projectCell(props.project), frame: props.project.frame, rotation: props.project.rotation, zoom: props.zoom, scroll: props.scroll, viewport: size.value }),
)

/** The numbers' size: 11px, 12px on a phone (Rulers card). */
function rulerFontPx(): number {
  return window.innerWidth <= 743 ? 12 : 11
}

/** The rulers of this view, laid out once: the overlay draws them and a press asks them what it selects, so the two
 * cannot disagree. */
const rulers = computed(() => rulerLayout(toRaw(props.project), surface.value, { fontPx: rulerFontPx(), numbers: props.showRulers ?? true }))

/** Where the Selection is on screen, told to the Selection bar (ticket 415). */
watch(
  [surface, () => props.selection, size],
  () => {
    const selected = props.selection
    if (!selected || size.value.width === 0) {
      emit('selection-anchor', undefined)
      return
    }
    const box = surface.value.beadBox(selectionFrame(selected), selectionLayer(props.project, selected))
    emit('selection-anchor', { box: { left: box.x, top: box.y, width: box.width, height: box.height }, viewport: { ...size.value } })
  },
  { immediate: true, flush: 'post' },
)

/** Where the Frame is on screen, none once it is out of view (tickets 417, 427, 452, 473): told to the Move handle and
 * the edit pencil. */
const frameAnchor = computed<FrameAnchor | undefined>(() => {
  const frame = props.project.frame
  if (!frame || size.value.width === 0) return undefined
  const box = surface.value.frameBox(frame)
  // Scrolled wholly out of view, the Frame has no controls to keep on screen: they are clamped to the box only while
  // some of it shows.
  const { width, height } = size.value
  if (box.x + box.width <= 0 || box.y + box.height <= 0 || box.x >= width || box.y >= height) return undefined
  const origin = surface.value.beadBox({ row: 0, column: 0, rows: 1, columns: 1 }, 'canvas')
  return {
    box: { left: box.x, top: box.y, width: box.width, height: box.height },
    viewport: { ...size.value },
    origin: { left: origin.x, top: origin.y, width: origin.width, height: origin.height },
  }
})
watch(frameAnchor, (anchor) => emit('frame-anchor', anchor), { immediate: true, flush: 'post' })

// Tests read what was drawn from the layout the surface built.
defineExpose({ rulerLayout: rulers, pressMoveHandle })

/** Animation frames asked for and not yet run, so they can be cancelled with the surface. */
const pendingFrames = new Set<number>()

/** A draw that waits for the next animation frame and runs once however often asked (pinch/wheel burst); draws at
 * once without frames. */
function oncePerFrame(draw: () => void): () => void {
  let frame: number | undefined
  return () => {
    if (typeof requestAnimationFrame !== 'function') {
      draw()
      return
    }
    if (frame !== undefined) {
      return
    }
    frame = requestAnimationFrame(() => {
      pendingFrames.delete(frame!)
      frame = undefined
      draw()
    })
    pendingFrames.add(frame)
  }
}

/** Whether finished rows show their normal color (ticket 352): while hovered by mouse/Pencil, or toggled by a tap.
 * View only, not saved or Undo. */
const hovered = ref(false)
const finishedRestored = ref(false)
const showFinished = computed(() => hovered.value || finishedRestored.value)

/** Row marks are drawn unless the Row highlight toggle is off; the project's own Row progress decides the rest. */
const marksShown = computed(() => props.rowMarks && rowProgressOn(props.project))
/** Where a mouse or a Pencil last was over the surface, so the hover can be asked again when the Project moves under
 * it. */
let hoverPoint: Pick<PointerEvent, 'clientX' | 'clientY'> | undefined

function hoversFinishedRow(bead: GridPosition | undefined): boolean {
  return bead !== undefined && isInFinishedRow(props.project, bead)
}

/** Draws the beads: all of them in view, or, when an edit changed only some rows of what is already drawn, just
 * those. */
function drawCells(): void {
  const canvas = baseEl.value
  if (!canvas || size.value.width === 0 || size.value.height === 0) {
    return
  }

  const pixelRatio = globalThis.devicePixelRatio || 1
  const region = currentRegion()
  const project = toRaw(props.project)
  const letters = shownLetters(project)
  const resized = sizeCanvas(canvas, region.width, region.height, pixelRatio)
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  const before = drawn
  drawn = { project, zoom: props.zoom, scroll: { ...props.scroll }, width: region.width, height: region.height, pixelRatio, theme: theme.value, showFinished: showFinished.value, rowMarks: marksShown.value }
  const bands =
    !resized &&
    before &&
    before.zoom === props.zoom &&
    before.scroll.x === props.scroll.x &&
    before.scroll.y === props.scroll.y &&
    before.width === region.width &&
    before.height === region.height &&
    before.pixelRatio === pixelRatio &&
    before.theme === theme.value &&
    before.showFinished === showFinished.value &&
    before.rowMarks === marksShown.value &&
    sameDrawing(before.project, project)
      ? changedBands(before.project, project)
      : undefined

  if (bands === undefined) {
    renderProject(context, { project, space: space.value, region, zoom: props.zoom, pixelRatio, theme: theme.value, showFinished: showFinished.value, rowMarks: marksShown.value, letters })
    return
  }
  for (const rows of bands) {
    renderProject(context, { project, space: space.value, region, zoom: props.zoom, pixelRatio, rows, theme: theme.value, showFinished: showFinished.value, rowMarks: marksShown.value, letters })
  }
}

/** How many beads a Project stores: counted once per set of beads, since an edit replaces it. */
const storedCounts = new WeakMap<object, number>()

function storedBeads(project: Project): number {
  const counted = (beads: Project['beads']) => {
    let count = storedCounts.get(beads)
    if (count === undefined) {
      count = Object.values(beads).reduce((sum, row) => sum + Object.keys(row).length, 0)
      storedCounts.set(beads, count)
    }
    return count
  }
  return counted(project.beads) + (project.frame ? counted(project.frame.beads) : 0)
}

let settleTimer: ReturnType<typeof setTimeout> | undefined

/** Puts the beads' canvas back to showing exactly what was drawn on it. */
function clearMove(): void {
  clearTimeout(settleTimer)
  settleTimer = undefined
  if (baseEl.value) baseEl.value.style.transform = ''
}

// Draws the beads, except while a very large piece is panned or zoomed (ticket 349): then the drawn bitmap is moved and
// scaled to follow, and drawn sharp after SETTLE_MS still, since a redraw per step would freeze the app. Other changes
// (edit, theme, rotation, resize) draw at once.
function drawCellsOrMove(): void {
  const before = drawn
  const canvas = baseEl.value
  const project = toRaw(props.project)
  const pixelRatio = globalThis.devicePixelRatio || 1
  const onlyViewMoved =
    before &&
    canvas &&
    before.project === project &&
    before.width === size.value.width &&
    before.height === size.value.height &&
    before.pixelRatio === pixelRatio &&
    before.theme === theme.value &&
    before.showFinished === showFinished.value &&
    before.rowMarks === marksShown.value &&
    props.zoom > 0 &&
    before.zoom > 0
  const heavy =
    onlyViewMoved &&
    beadsToDraw(storedBeads(project), project.frame ? project.frame.columns * project.frame.rows : 0, size.value, props.zoom) > GESTURE_BEAD_LIMIT
  if (!heavy || !before) {
    clearMove()
    drawCells()
    return
  }

  const { scale, x, y } = gestureTransform(before, { zoom: props.zoom, scroll: props.scroll })
  canvas!.style.transformOrigin = '0 0'
  canvas!.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    clearMove()
    drawCells()
  }, SETTLE_MS)
}

// Where the bead-shaped marker stands for the pointer (ticket 353), in px from the surface's top-left: over beads, for
// a mouse or hovering pen (OS pointer hidden). None with a canvas-moving tool, while the
// Frame is set, or for a finger (no hover).
const markerAt = ref<{ x: number; y: number; layer: ViewLayer }>()
/** Whether the pointer last seen over the surface is one that draws and hovers: not a finger, not the one the input
 * mode keeps for moving the canvas. */
let hoverDraws = false
/** Whether that pointer is a hovering Pencil, whose marker stands off the tip so the hand does not cover it. */
let hoverPen = false
/** How far up, and to the side away from the writing hand, of a hovering Pencil's tip the marker stands, in px, clear
 * of the hand resting below and beside it. */
const PEN_MARKER_OFFSET_PX = 18

/** Puts the marker where the hovering pointer is, if it is over a bead it may place; asked again when the canvas
 * moves under a still pointer. */
function placeMarker(): void {
  const bead = hoverPoint && hoverDraws && !dragging.value && !framing.value ? beadUnder(hoverPoint) : undefined
  if (!hoverPoint || !bead || refusesMargin(bead)) {
    markerAt.value = undefined
    return
  }
  const { x, y } = pointInSurface(hoverPoint)
  const offset = hoverPen ? PEN_MARKER_OFFSET_PX : 0
  const side = props.handedness === 'left' ? 1 : -1
  markerAt.value = { x: x + side * offset, y: y - offset, layer: layerAt(props.project, bead) }
}

/** Takes the marker away, and keeps it away until the pointer moves again. */
function hideMarker(): void {
  hoverDraws = false
  markerAt.value = undefined
}

/** Whether a Frame gesture is in progress (a press that grabbed the Frame or drew a new one). */
const framing = ref(false)
/** Whether a Frame gesture is in progress or a stepper has just changed the size: the size tooltip shows only then
 * (ticket 452). */
const sizeFlash = ref(false)
let sizeTimer: ReturnType<typeof setTimeout> | undefined
const sizeShown = computed(() => framing.value || sizeFlash.value)
/** The Frame's size tooltip follows a size change that did not come from a drag (an edge stepper, a key) for a
 * moment. */
watch(
  () => [props.project.frame?.columns, props.project.frame?.rows],
  () => {
    if (!props.settingFrame || framing.value) return
    sizeFlash.value = true
    clearTimeout(sizeTimer)
    sizeTimer = setTimeout(() => (sizeFlash.value = false), SIZE_FLASH_MS)
  },
)

const marginOpacity = ref(props.project.frame ? 1 : 0)

/** Draws the overlay: everything over the beads that comes and goes with a tool or the pointer. */
function drawOverlay(): void {
  const canvas = overlayEl.value
  if (!canvas || size.value.width === 0 || size.value.height === 0) {
    return
  }

  const pixelRatio = globalThis.devicePixelRatio || 1
  const region = currentRegion()
  sizeCanvas(canvas, region.width, region.height, pixelRatio)
  const context = canvas.getContext('2d')
  if (context) {
    renderOverlay(context, {
      project: toRaw(props.project),
      space: space.value,
      region,
      zoom: props.zoom,
      pixelRatio,
      theme: theme.value,
      rowMarks: marksShown.value,
      letters: shownLetters(toRaw(props.project)),
      pointer: markerAt.value && !props.tool && !handMoves.value && !props.markerHidden && !props.picking && !props.selecting ? { ...markerAt.value, color: props.previewColor ?? null } : undefined,
      preview: !props.picking && props.previewCells && props.previewCells.length > 0 ? { cells: props.previewCells, color: props.previewColor ?? null } : undefined,
      selection: props.selection,
      marginOutline: marginOpacity.value,
      frameEditing: props.settingFrame ? { touch: touchInput.value, tooltip: sizeShown.value ? (props.frameTooltip ?? '') : '' } : undefined,
      selectionHandles: props.selecting ? { surface: surface.value, touch: touchInput.value } : undefined,
      rulers: { layout: rulers.value, surface: surface.value },
    })
  }
}

// What is under a still pointer changes when the canvas moves or zooms, or the weaver's row does (Undo, the Progress
// bar).
watch([() => props.project, () => props.zoom, () => props.scroll], () => {
  placeMarker()
  if (hoverPoint) {
    hovered.value = hoversFinishedRow(beadUnder(hoverPoint))
  }
})

// The Project is replaced whole by every edit, so its identity is all that needs watching: a deep watch would make the
// draw depend on every bead's property.
watch([size, () => props.project, () => props.zoom, () => props.scroll, theme, showFinished, marksShown], oncePerFrame(drawCellsOrMove), { flush: 'post' })
watch(
  [
    size,
    () => props.project,
    () => props.zoom,
    () => props.scroll,
    () => props.previewCells,
    () => props.previewColor,
    markerAt,
    () => props.selection,
    () => props.showRulers,
    marksShown,
    () => props.settingFrame,
    sizeShown,
    handMoves,
    () => props.markerHidden,
    () => props.selecting,
    () => props.picking,
    () => props.frameTooltip,
    marginOpacity,
    touchInput,
    theme,
  ],
  oncePerFrame(drawOverlay),
  { flush: 'post' },
)

// Pointer events (ticket 60), not mouse events, so strokes work the same by mouse, touch and pen. The surface is one
// element, so the bead is worked out from the position (the Surface view's pointToBead), and only a change of bead is
// news. Touch/pen keep implicit capture on the surface.
const overBead = ref(false)
/** Whether the pointer is over the Frame's margin with a tool that cannot place beads there. */
const overRefusedMargin = ref(false)
const dragging = ref(false)
/** Whether the Selection's handles or inside are held (ticket 414). */
const adjusting = ref(false)
/** The resize cursor over one of the Selection's handles, while the pointer hovers one. */
const handleCursor = ref<string>()
let lastBead: GridPosition | undefined

// The Frame margin's outline (ticket 276, Frame card): always shown with a Frame (ticket 452) and 1s after a refused
// margin press, faded over --duration-fast, redrawn on the overlay frame by frame; with reduced motion shown and hidden
// at once.
const SIZE_FLASH_MS = 1200
const MARGIN_FADE_MS = 120
const REFUSED_PRESS_MS = 1000
const refusedPress = ref(false)
let refusedTimer: ReturnType<typeof setTimeout> | undefined
let fadeFrame: number | undefined

const marginOutlineWanted = computed(() => props.project.frame !== undefined || refusedPress.value)

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

watch(marginOutlineWanted, (wanted) => {
  if (fadeFrame !== undefined) cancelAnimationFrame(fadeFrame)
  const target = wanted ? 1 : 0
  if (reducedMotion() || typeof requestAnimationFrame !== 'function') {
    marginOpacity.value = target
    return
  }
  const from = marginOpacity.value
  // The fade starts at the first frame's own timestamp: it is not always on performance.now()'s clock.
  let start: number | undefined
  const step = (now: number) => {
    start ??= now
    const done = Math.min(1, (now - start) / MARGIN_FADE_MS)
    marginOpacity.value = from + (target - from) * done
    fadeFrame = done < 1 ? requestAnimationFrame(step) : undefined
  }
  fadeFrame = requestAnimationFrame(step)
})

watch(
  () => props.selectionRefusals,
  (now, before) => {
    if (now !== undefined && now !== before) refusePress()
  },
)

function refusePress(): void {
  refusedPress.value = true
  clearTimeout(refusedTimer)
  refusedTimer = setTimeout(() => (refusedPress.value = false), REFUSED_PRESS_MS)
}

let lastPoint = { x: 0, y: 0 }

function beadUnder(event: Pick<PointerEvent, 'clientX' | 'clientY'>): GridPosition | undefined {
  const root = rootEl.value
  if (!root) {
    return undefined
  }
  const box = root.getBoundingClientRect()
  const point = { x: event.clientX - box.left, y: event.clientY - box.top }
  // The Select tool marks out a rectangle of a Custom frame's cells on screen, between its beads too (ticket 0594).
  return (props.selectAnywhere ? surface.value.frameCellAt(point) : undefined) ?? surface.value.pointToHit(point)
}

/** The color chip beside the eyedropper (ticket 403): what a press would take, live over beads; none over an empty
 * cell or for a finger. */
const pickChip = ref<{ x: number; y: number; hex: string; flipX: boolean; flipY: boolean }>()

function placePickChip(event: PointerEvent, bead: GridPosition | undefined): void {
  const shown = eyedropperShown.value && bead && event.pointerType !== 'touch' && !movesCanvas(event)
  const hex = shown ? beadColorAt(props.project, bead.row, bead.column, bead.layer) : null
  const box = rootEl.value?.getBoundingClientRect()
  if (!hex || !box) {
    pickChip.value = undefined
    return
  }
  const x = event.clientX - box.left
  const y = event.clientY - box.top
  // Near the right or bottom edge the chip goes to the other side of the tip instead of being cut off.
  pickChip.value = { x, y, hex, flipX: x > box.width - PICK_CHIP_ROOM.x, flipY: y > box.height - PICK_CHIP_ROOM.y }
}

/** The room the chip needs right of and below the tip, in px: its width with a full hex, and its height, plus the
 * offset. */
const PICK_CHIP_ROOM = { x: 110, y: 40 }

// A zoom, scroll or end of the pick leaves the chip showing a bead that is no longer under the pointer.
watch(
  () => [eyedropperShown.value, props.zoom, props.scroll.x, props.scroll.y],
  () => {
    pickChip.value = undefined
  },
)

/** Whether the Select tool is in hand and the bead lies in the margin, which a Selection cannot start in (ticket
 * 428). */
function refusesSelectionStart(bead: GridPosition): boolean {
  if (props.selectionBlocksMargin !== true) return false
  // A Frame whose kind offers no Selection refuses one as the margin does (a Custom frame, ticket 0592).
  return inMargin(footprintOf(props.project), bead) || (layerAt(props.project, bead) === 'frame' && !frameAllows(props.project.frame, 'select'))
}

function refusesMargin(bead: GridPosition | undefined): boolean {
  if (bead === undefined) return false
  if (refusesSelectionStart(bead)) return true
  return props.blocksMargin === true && !mayPlace(props.project, bead)
}

/** A bead's row and column for an event, and its layer only where the position alone would name the other one (ADR 0066):
 * where the Frame draws shorter than the rows it names. */
function cellArguments(bead: GridPosition): [row: number, column: number, layer?: Layer] {
  const named = bead.layer
  return named && named !== layerAt(props.project, { row: bead.row, column: bead.column }) ? [bead.row, bead.column, named] : [bead.row, bead.column]
}

function isSameBead(a: GridPosition | undefined, b: GridPosition | undefined): boolean {
  return a?.row === b?.row && a?.column === b?.column && a?.layer === b?.layer
}

// A finger has no true hover: its "hover" arrives glued to a press or drag, flashing a preview of what a same-instant
// paint shows. Suppressed there (`responsive.md`, "no hover paint preview" for coarse pointers); a Pencil keeps its
// hover, a mouse was never touch.
function hoversFor(event: PointerEvent): boolean {
  return event.pointerType !== 'touch'
}

/** Whether this pointer is the one that moves the canvas in the input mode (ticket 325): Pen mode's finger and
 * mouse, Mouse mode's pen. */
function movesCanvas(event: PointerEvent): boolean {
  return props.inputMode !== undefined && !pointerDraws(props.inputMode, event.pointerType)
}

/** A press that moves the canvas instead of drawing: the Hand tool (or Space), the middle or right button on any tool
 * (ticket 541), or the pointer the input mode keeps for moving. */
function startsDrag(event: PointerEvent): boolean {
  return handMoves.value || event.button === 1 || event.button === 2 || movesCanvas(event)
}

/** The point of the viewport a pointer is at, in px from its top-left corner. */
function pointInSurface(event: Pick<PointerEvent, 'clientX' | 'clientY'>): { x: number; y: number } {
  const box = rootEl.value?.getBoundingClientRect()
  return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
}

/** The bead position nearest a pointer, wherever it is: dragging a Frame needs one even between beads. */
function cellUnder(event: PointerEvent, layer: ViewLayer = gestureLayer): GridPosition {
  return surface.value.pointToCell(pointInSurface(event), layer)
}

/** The layer whose geometry a held press is measured in (ticket 492): the Frame's for its resize handles and a
 * Selection on it, the Canvas's for the Move handle and anything else. */
let gestureLayer: ViewLayer = 'canvas'

/** The layer a Selection acts on, for measuring a press on its handles. */
function selectionViewLayer(): ViewLayer {
  return props.selection ? selectionLayer(props.project, props.selection) : 'canvas'
}

/** What a press grabs of the Frame's chrome (ticket 452): a resize handle, only while edit is on; nothing otherwise,
 * so the tool gets the press. The Move handle's own press comes through `pressMoveHandle`. */
function framePress(event: PointerEvent, touch = touchInput.value): FramePress | undefined {
  const point = pointInSurface(event)
  if (!props.settingFrame) return undefined
  const target = framePressAt(props.project.frame, surface.value, props.project.rotation, point, touch)
  return target.kind === 'handle' ? target : undefined
}

/** While a Frame is dragged with the pointer at the edge, the view scrolls toward it each frame and the drag follows
 * (the pointer is still, so no move event would say so). */
let framePointer: Pick<PointerEvent, 'clientX' | 'clientY'> | undefined
let edgeScrollFrame = 0
function edgeScrollTick(): void {
  edgeScrollFrame = 0
  if (!framing.value) {
    framePointer = undefined
    return
  }
  if (!framePointer) return
  const point = pointInSurface(framePointer)
  const { dx, dy } = edgeScrollStep(point, size.value)
  if (dx !== 0 || dy !== 0) {
    emit('pan', -dx, -dy)
    // After the parent has applied the pan, so the cell under the still pointer is the new one.
    void nextTick(() => {
      if (framing.value) emit('frame-drag', surface.value.pointToCell(point, gestureLayer))
    })
  }
  edgeScrollFrame = requestAnimationFrame(edgeScrollTick)
}

/** A press on the Move handle's button over the canvas (ticket 455): the same grab as a press on the handle itself. */
function pressMoveHandle(event: PointerEvent): void {
  if (!props.project.frame || event.button !== 0) return
  touchInput.value = event.pointerType === 'touch'
  onPress(event)
  framing.value = true
  hideMarker()
  rootEl.value?.setPointerCapture?.(event.pointerId)
  gestureLayer = 'canvas'
  emit('frame-press', { kind: 'move' }, cellUnder(event))
  event.preventDefault()
}

function onPointerDown(event: PointerEvent): void {
  penAt.value = undefined
  touchInput.value = event.pointerType === 'touch'
  if (props.project.frame && event.pointerType === 'touch' && !event.isPrimary) {
    // A second finger is a pinch (usePinchPan): whatever the first was dragging is let go, uncommitted.
    if (framing.value) {
      framing.value = false
      emit('frame-cancel')
    }
    return
  }
  if (props.project.frame && !startsDrag(event) && event.button === 0) {
    const target = framePress(event)
    if (target) {
      framing.value = true
      hideMarker()
      rootEl.value?.setPointerCapture?.(event.pointerId)
      gestureLayer = target.kind === 'handle' ? 'frame' : 'canvas'
      emit('frame-press', target, cellUnder(event))
      event.preventDefault()
      return
    }
  }
  if (props.selecting && props.selection && event.button === 0 && !(event.pointerType === 'touch' && !event.isPrimary) && !startsDrag(event)) {
    // A Selection too small for handles (ticket 435) has none to grab: a press inside it only moves it. A shape (ticket
    // 547) can't be grabbed at all.
    const box = surface.value.beadBox(selectionFrame(props.selection), selectionViewLayer())
    const point = pointInSurface(event)
    const target: FramePress = props.selection.cells
      ? { kind: 'outside' }
      : selectionHasHandles(props.selection)
        ? boxPressAt(box, props.project.rotation, point, touchInput.value)
        : { kind: pointInBox(box, point) ? 'inside' : 'outside' }
    if (target.kind !== 'outside') {
      adjusting.value = true
      hideMarker()
      rootEl.value?.setPointerCapture?.(event.pointerId)
      gestureLayer = selectionViewLayer()
      emit('selection-press', target, cellUnder(event))
      event.preventDefault()
      return
    }
  }
  if (startsDrag(event)) {
    dragging.value = true
    lastPoint = { x: event.clientX, y: event.clientY }
    lastBead = undefined
    overBead.value = false
    overRefusedMargin.value = false
    hideMarker()
    rootEl.value?.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    return
  }

  // A ruler number is display-only (ticket 447): the press goes to the active tool at that spot.
  const bead = beadUnder(event)
  overBead.value = bead !== undefined
  const offShape = !bead && surface.value.offShapeAt(pointInSurface(event))
  overRefusedMargin.value = refusesMargin(bead) || offShape
  // A Custom frame's Seams and Off-shape hold no bead (ticket 0592): a press there is refused, as on the margin.
  if (offShape) {
    lastBead = undefined
    if (event.button === 0) refusePress()
    return
  }
  if (!bead) {
    lastBead = undefined
    // A press on empty background still opens the stroke (ticket 504); Fill lands on the nearest bead instead.
    if (event.button === 0) {
      if (props.nearestOnPress || props.selectAnywhere) {
        const near = cellUnder(event, 'canvas')
        if (props.selectAnywhere) {
          selectDrag = true
          selectLayer = 'canvas'
          rootEl.value?.setPointerCapture?.(event.pointerId)
        }
        emit('cell-primary-down', near.row, near.column)
      } else {
        stroke = { from: pointInSurface(event), last: undefined }
      }
    }
    return
  }
  if (event.button === 0) {
    stroke = { from: pointInSurface(event), last: bead }
  }
  // A press also lands where the pasted block under the pointer goes (the preview cells).
  if (event.button === 0 && (refusesMargin(bead) || (props.previewCells ?? []).some((cell) => refusesMargin(cell)))) {
    refusePress()
    if (refusesSelectionStart(bead)) return
  }

  // A touch has not been over the bead before it lands on it: the hover comes first, as the bead's pointerenter did.
  if (!isSameBead(bead, lastBead)) {
    lastBead = bead
    if (hoversFor(event)) emit('cell-hover', ...cellArguments(bead))
  }

  if (event.button === 0) {
    // A press that starts a Selection is captured, so its release is delivered even off the canvas (ticket 503).
    if (props.selecting) rootEl.value?.setPointerCapture?.(event.pointerId)
    selectDrag = props.selectAnywhere === true
    selectLayer = bead.layer === 'frame' ? 'frame' : 'canvas'
    // A press on a finished row never draws (the lock), and, while its dimming shows, toggles the finished rows between dimmed and normal.
    if (marksShown.value && isInFinishedRow(props.project, bead) && !(event.pointerType === 'touch' && !event.isPrimary)) {
      finishedRestored.value = !finishedRestored.value
    }
    emit('cell-primary-down', ...cellArguments(bead))
  }
}

// Reports the hover for the preview, plus a drag move when the primary button is held, which continues a paint/fill
// stroke (ticket 24). `buttons` is 1 for touch/pen in contact, so one branch covers all three input kinds.
function onPointerMove(event: PointerEvent): void {
  placePen(event)
  if (adjusting.value) {
    emit('selection-drag', cellUnder(event))
    return
  }
  if (props.selecting && props.selection && event.pointerType !== 'touch' && selectionHasHandles(props.selection)) {
    const id = handleIdAt(surface.value.beadBox(selectionFrame(props.selection), selectionViewLayer()), pointInSurface(event), false)
    handleCursor.value = id ? HANDLE_CURSORS[id] : undefined
  } else if (props.project.frame && event.pointerType !== 'touch' && !framing.value) {
    const target = framePress(event)
    handleCursor.value = target?.kind === 'move' ? 'grab' : target?.kind === 'handle' ? HANDLE_CURSORS[frameHandleIdAt(props.project.frame, surface.value, pointInSurface(event), false)!] : undefined
  } else {
    handleCursor.value = undefined
  }
  if (framing.value) {
    framePointer = { clientX: event.clientX, clientY: event.clientY }
    if (!edgeScrollFrame && typeof requestAnimationFrame === 'function') edgeScrollFrame = requestAnimationFrame(edgeScrollTick)
    emit('frame-drag', cellUnder(event))
    return
  }
  if (dragging.value) {
    emit('pan', event.clientX - lastPoint.x, event.clientY - lastPoint.y)
    lastPoint = { x: event.clientX, y: event.clientY }
    return
  }
  // A finger has no true hover: only a mouse or a Pencil restores the finished rows, and only by being over one of
  // them.
  const bead = beadUnder(event)
  hoverPoint = event.pointerType === 'touch' ? undefined : { clientX: event.clientX, clientY: event.clientY }
  hovered.value = hoverPoint !== undefined && hoversFinishedRow(bead)
  hoverDraws = hoversFor(event) && !movesCanvas(event)
  hoverPen = event.pointerType === 'pen'
  // The Hand tool never hovers: it changes no bead, so there is nothing to preview. Nor does the pointer that only
  // moves the canvas.
  if (handMoves.value || movesCanvas(event)) {
    overBead.value = false
    overRefusedMargin.value = false
    hideMarker()
    return
  }

  overBead.value = bead !== undefined
  overRefusedMargin.value = refusesMargin(bead) || (!bead && surface.value.offShapeAt(pointInSurface(event)))
  placeMarker()
  placePickChip(event, bead)
  if (selectDrag && event.buttons & 1) {
    const near = cellUnder(event, selectLayer)
    emit('cell-primary-move', near.row, near.column)
    return
  }
  selectDrag = false
  continueStroke(event)
  if (isSameBead(bead, lastBead)) {
    return
  }
  lastBead = bead
  if (!bead) {
    return
  }

  if (hoversFor(event)) emit('cell-hover', ...cellArguments(bead))
}

/** A Select drag in progress (ticket 505): every move reports the nearest bead position, over a bead or not, in the
 * geometry of the layer it began on. */
let selectDrag = false
let selectLayer: ViewLayer = 'canvas'

/** The press-to-release stroke (ticket 504): holes and empty background neither end it nor need a bead to resume. */
let stroke: { from: { x: number; y: number }; last: GridPosition | undefined } | undefined

/** How far apart, in px, a swipe is sampled for beads: finer than the smallest bead on screen. */
const STROKE_SAMPLE_PX = 2

/** Reports every bead on the straight line from the stroke's last sample to the pointer, found in position space. */
function continueStroke(event: PointerEvent): void {
  if (!stroke) return
  if (!(event.buttons & 1)) {
    stroke = undefined
    return
  }
  const to = pointInSurface(event)
  const { x, y } = stroke.from
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - x, to.y - y) / STROKE_SAMPLE_PX))
  for (let step = 1; step <= steps; step++) {
    const bead = surface.value.pointToHit({ x: x + ((to.x - x) * step) / steps, y: y + ((to.y - y) * step) / steps })
    if (!bead || isSameBead(bead, stroke.last)) continue
    const first = stroke.last === undefined
    stroke.last = bead
    if (first) emit('cell-primary-down', ...cellArguments(bead))
    else emit('cell-primary-move', ...cellArguments(bead))
  }
  stroke.from = to
}

function onPointerEnd(event?: PointerEvent): void {
  stroke = undefined
  selectDrag = false
  releasePointer(event)
  dragging.value = false
  if (adjusting.value) {
    adjusting.value = false
    emit('selection-release')
  }
  if (framing.value) {
    framing.value = false
    emit('frame-release')
  }
}

/** A cancelled pointer is a pen gone out of range or a gesture taken over: it has no marker to show. */
function onPointerCancel(): void {
  penAt.value = undefined
  onPointerEnd()
  hideMarker()
}

function onPointerLeave(): void {
  penAt.value = undefined
  hovered.value = false
  hoverPoint = undefined
  lastBead = undefined
  overBead.value = false
  overRefusedMargin.value = false
  pickChip.value = undefined
  hideMarker()
  emit('hover-end')
}

/** The wheel's distance in px whichever unit the device reports it in. */
function wheelPx(delta: number, mode: number): number {
  return mode === 1 ? delta * 16 : mode === 2 ? delta * size.value.height : delta
}

/** Ctrl/⌘ + wheel zooms (a trackpad's pinch arrives the same way); the wheel on its own moves the canvas, Shift
 * turning a vertical wheel sideways. */
function onWheel(event: WheelEvent): void {
  event.preventDefault()
  noteWheel()
  const box = rootEl.value?.getBoundingClientRect()
  const dx = wheelPx(event.deltaX, event.deltaMode)
  const dy = wheelPx(event.deltaY, event.deltaMode)
  if (event.ctrlKey || event.metaKey) {
    const step = Math.max(-30, Math.min(30, dy))
    emit('zoom-by', Math.exp(-step * 0.01), { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) })
    return
  }
  const sideways = event.shiftKey && dx === 0
  emit('scroll', sideways ? dy : dx, sideways ? 0 : dy)
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(rootEl.value)
  }
  window.addEventListener('resize', measure, { passive: true })
  window.addEventListener('blur', dropPressedPointers)
  window.addEventListener('pointerup', onWindowPointerEnd)
  window.addEventListener('pointercancel', onWindowPointerEnd)
})

onBeforeUnmount(() => {
  clearTimeout(wheelTimer)
  clearTimeout(refusedTimer)
  clearTimeout(sizeTimer)
  clearTimeout(settleTimer)
  if (edgeScrollFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(edgeScrollFrame)
  if (fadeFrame !== undefined) cancelAnimationFrame(fadeFrame)
  pendingFrames.forEach((frame) => cancelAnimationFrame(frame))
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measure)
  window.removeEventListener('blur', dropPressedPointers)
  window.removeEventListener('pointerup', onWindowPointerEnd)
  window.removeEventListener('pointercancel', onWindowPointerEnd)
})
</script>

<template>
  <div
    ref="rootEl"
    class="project-surface"
    data-testid="project-surface"
    :data-technique="project.technique"
    :data-brick-block="project.brickBlock"
    :data-net-size="project.netSize"
    :data-rotation="project.rotation"
    :data-zoom="zoom"
    :data-scroll-x="scroll.x"
    :data-scroll-y="scroll.y"
    :class="{
      'project-surface--over-bead': overBead && !tool && !handMoves && !picking && !selecting,
      'project-surface--picking': eyedropperShown,
      'project-surface--refused': overRefusedMargin && !handMoves,
      'project-surface--moving': handMoves,
      'project-surface--dragging': dragging,
    }"
    :style="eyedropperShown ? { cursor: EYEDROPPER_CURSOR } : handleCursor ? { cursor: handleCursor } : toolCursor ? { cursor: toolCursor } : undefined"
    role="img"
    :aria-label="label"
    @pointerdown.capture="onPress"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerCancel"
    @lostpointercapture="onPointerEnd"
    @pointerleave="onPointerLeave"
    @wheel="onWheel"
    @contextmenu.prevent
  >
    <canvas ref="baseEl" class="project-surface__canvas" data-testid="project-surface-cells" />
    <canvas ref="overlayEl" class="project-surface__canvas" data-testid="project-surface-overlay" />
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
      class="project-surface__pick-chip"
      :class="{ 'project-surface__pick-chip--flip-x': pickChip.flipX, 'project-surface__pick-chip--flip-y': pickChip.flipY }"
      :style="{ left: `${pickChip.x}px`, top: `${pickChip.y}px`, '--pick-color': pickChip.hex }"
      data-testid="pick-chip"
      aria-hidden="true"
    ><span class="project-surface__pick-chip-swatch" />{{ pickChip.hex }}</span>
  </div>
</template>

<style scoped>
.project-surface {
  position: absolute;
  inset: 0;
  overflow: hidden;
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

.project-surface__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
</style>
