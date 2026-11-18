import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type EmitFn, type Ref, type ShortEmitsToObject } from 'vue'
import { ownLength, ownPoint } from '../../../composables/ui/cssZoom'
import { pressBecomes, type CanvasPress, type CanvasPressStep } from '../../../domain/canvasPress'
import { layerAt } from '../../../domain/layers'
import { footprintOf } from '../../../domain/footprint'
import { frameAllows } from '../../../domain/frameShape'
import { inMargin, mayPlace } from '../../../domain/margin'
import type { GridPosition, Layer, PreviewCell } from '../../../domain/grid'
import { HOLD_MS } from '../../../domain/hold'
import { pointerDraws, type Handedness, type InputMode } from '../../../domain/inputMode'
import { beadColorAt } from '../../../domain/layerBeads'
import { isInFinishedRow } from '../../../domain/rowProgress'
import type { Project } from '../../../domain/project'
import { selectionFrame, selectionHasHandles, selectionLayer, stampCells, type PasteStamp, type Selection } from '../../../domain/selection'
import type { ToolCapabilities } from '../../../domain/tool'
import { AREA_SHEET_OUTSET, areaPressAt, frameHandleIdAt, framePressAt, handleIdAt, HANDLE_CURSORS, pointInBox, type FramePress, type HandleId } from '../../../rendering/frameHandles'
import type { SheetArea } from '../../../composables/tools/selectionBarPlacement'
import type { Scroll, SurfaceView, ViewLayer } from '../../../rendering/surfaceView'
import type { Size } from '../../../rendering/cellSize'
import type { TiltedView } from '../../../rendering/tiltedView'
import { edgeScrollStep } from '../../../composables/canvas/edgeScroll'
import { EYEDROPPER_CURSOR, EYEDROPPER_IMAGE } from '../eyedropperCursor'
import { toolPointer, toolPointerImage } from '../toolCursors'
import { REFUSED_PRESS_MS } from './useSurfaceOverlay'
import { frameOf, quarterTurnOf } from '../../../domain/layerRecord'
import type { MirrorSetting } from '../../../domain/mirror'
import type { FrameEdge } from '../../../domain/frame'
import type { SelectionDragKind } from '../../../composables/tools/useSelectionGesture'

/** How near the canvas box's edge a Select drag by a finger or a Pencil must end to have slid off the glass, and how
 * near it, and how soon, the finger coming back must land to pick the drag back up (ticket 0805). */
const OFF_THE_GLASS_PX = 24
const BACK_ON_THE_GLASS_PX = 48
const BACK_ON_THE_GLASS_MS = 1000

/** What a press, a drag, the hover and the wheel on the Drawing surface tell the canvas panel. */
export interface SurfacePointerEvents {
  'cell-primary-down': [row: number, column: number, layer?: Layer]
  'cell-primary-move': [row: number, column: number, layer?: Layer]
  /** The beads a stroke crossed since the last pointer move, in order, every one on the line (ticket 0674): one move
   * of the pointer, which the browser sends once a frame, is one stroke step. */
  'cells-primary-move': [cells: GridPosition[]]
  'cell-hover': [row: number, column: number, layer?: Layer]
  'hover-end': []
  /** The canvas was dragged by this many px (the Hand tool, the middle button, a right-button drag). */
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
  /** The Selection's handles or inside were pressed (ticket 414), at this bead position; or the move grip of an
   * area's bar, which names the area it moves (ticket 0808). */
  'selection-press': [target: FramePress, cell: GridPosition, area?: SheetArea]
  /** The pointer moved with that press held, over this bead position. */
  'selection-drag': [cell: GridPosition]
  /** That press ended. */
  'selection-release': []
  /** A finger or a Pencil that comes back onto the glass picks up the drag that slid off it (ticket 0805): marking out the
   * Selection, or resizing it. A release ends it again as usual. */
  'selection-resume': [kind: SelectionDragKind]
  /** Edit Frame: a second finger landed, so the press was a pinch, not a drag: drop what was dragged. */
  'frame-cancel': []
  /** Whether a pointer is down on the surface (a gesture, pan or pinch is running): the Selection bar steps aside
   * meanwhile. */
  pressing: [pressing: boolean]
  /** A right click asked for the Radial toolbox (ticket 1064): where it was pressed, in client px, and the bead position
   * under it, none between positions or off the grid. */
  'open-toolbox': [at: { x: number; y: number }, position?: GridPosition]
  /** A hold is being timed at this point, in client px (ticket 1065): the hairline is drawn round it. With no point it
   * stopped: the pointer moved or lifted, a second finger landed, or the hold is up and the ring opens. */
  hold: [at?: { x: number; y: number }]
  /** A hold is up: drop what its press started, as a pinch's first finger is dropped. `open-toolbox` follows. */
  'drop-press': []
}

/** What the pointer reads: the surface's props, its root and layout, and the margin cue it sets off. */
export interface SurfacePointerDeps {
  props: {
    project: Project
    zoom: number
    scroll: Scroll
    tools: ToolCapabilities
    previewCells?: PreviewCell[]
    previewStamp?: PasteStamp
    previewColor?: string | null
    selection?: Selection
    inputMode?: InputMode
    handedness?: Handedness
    /** How many Fill presses Fill reach has refused (ticket 0715): each shows the not-allowed pointer for a moment. */
    fillRefusals?: number
    /** The Mirror (ADR 0082): in Mirror mode its Canvas Area's handles take a press as the Selection's do. */
    mirror?: MirrorSetting
    /** Whether a hold with the drawing pointer opens the Radial toolbox (ticket 1065): it is timed only then. */
    holdOpens?: boolean
    /** How many holds a pinch has ended: the surface never hears the second finger of one (usePinchPan). */
    holdEnds?: number
  }
  emit: EmitFn<ShortEmitsToObject<SurfacePointerEvents>>
  root: Ref<HTMLElement | undefined>
  /** The surface's size on screen. */
  size: Ref<Size>
  /** The view of the drawing, at the Canvas's quarter turn: a point is turned onto it from the screen first. */
  surface: Ref<SurfaceView>
  /** How the drawing leans off its quarter turn on screen (ticket 0672). */
  leaning: Ref<TiltedView>
  /** Whether the Row progress look is drawn: a press on a finished row then toggles its dimming (ticket 352). */
  marksShown: Ref<boolean>
  /** Shows the margin's outline for a moment: a press there was refused. */
  refuse: () => void
}

/** How long after the last wheel event a wheel or trackpad scroll or zoom counts as over, so the bar comes back
 * (ticket 415). */
const WHEEL_IDLE_MS = 150
/** How far up and left of the tip the hovering Pencil's pointer is drawn, in px, so the Pencil's own tip does not
 * cover the hot spot. */
const PEN_POINTER_NUDGE = 2
/** How far up, and to the side away from the writing hand, of a hovering Pencil's tip the marker stands, in px, clear
 * of the hand resting below and beside it. */
const PEN_MARKER_OFFSET_PX = 18
/** The room the pick chip needs right of and below the tip, in px: its width with a full hex, and its height, plus
 * the offset. */
const PICK_CHIP_ROOM = { x: 110, y: 40 }
/** How far apart, in px, a swipe is sampled for beads: finer than the smallest bead on screen. */
const STROKE_SAMPLE_PX = 2

function isSameBead(a: GridPosition | undefined, b: GridPosition | undefined): boolean {
  return a?.row === b?.row && a?.column === b?.column && a?.layer === b?.layer
}

// A finger has no true hover: its "hover" arrives glued to a press or drag, flashing a preview of what a same-instant
// paint shows. Suppressed there (`responsive.md`, "no hover paint preview" for coarse pointers); a Pencil keeps its
// hover, a mouse was never touch.
function hoversFor(event: PointerEvent): boolean {
  return event.pointerType !== 'touch'
}

/** The Drawing surface's pointer and cursor (ticket 0619): it reads presses, drags, hover and the wheel (ticket 60:
 * pointer events, so mouse, touch and pen work alike) into bead positions and gestures, and picks the cursor, the bead
 * marker, the hovering Pencil's pointer and the pick chip that show for them. */
export function useSurfacePointer({ props, emit, root: rootEl, size, surface, leaning, marksShown, refuse: refusePress }: SurfacePointerDeps) {
  /** Whether the chosen Tool moves the canvas right now: the Hand tool. */
  const handMoves = computed(() => props.tools.moves)
  /** Whether the pointer is the eyedropper (ticket 403): picking, unless the canvas is being moved (Hand, Space). */
  const eyedropperShown = computed(() => props.tools.picking && !props.tools.markerHidden && !handMoves.value)

  // The surface is one element, so the bead is worked out from the position (the Surface view's pointToBead), and only
  // a change of bead is news. Touch/pen keep implicit capture on the surface.
  const overBead = ref(false)
  /** Whether the pointer is over the Frame's margin with a tool that cannot place beads there. */
  const overRefusedMargin = ref(false)
  const dragging = ref(false)
  /** Whether the Selection's handles or inside are held (ticket 414). */
  const adjusting = ref(false)
  /** Whether a Frame gesture is in progress (a press that grabbed the Frame or drew a new one). */
  const framing = ref(false)
  /** The resize cursor over one of the Selection's handles, while the pointer hovers one. */
  const handleCursor = ref<string>()
  /** The Frame's handle under the pointer, or the one a drag holds: Edit Frame grows it (MarginSheet card, ticket 0657). */
  const hotHandle = ref<HandleId>()
  /** The handle of a rectangle Selection or a Canvas Area under the pointer, or the one a drag holds: grown as the
   * Frame's is (ContextBar card, Area sheet, ticket 0807). */
  const hotAreaHandle = ref<HandleId>()
  /** Whether the last pointer was a finger: its Frame handles are the four larger corner ones. */
  const touchInput = ref(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
  let lastBead: GridPosition | undefined
  let lastPoint = { x: 0, y: 0 }
  /** Whether a Fill press was just refused (ticket 0715): the not-allowed pointer shows where it was, for a moment. */
  const fillRefused = ref(false)
  let fillRefusedTimer: ReturnType<typeof setTimeout> | undefined
  watch(() => props.fillRefusals, (now, before) => {
    if (now === undefined || now === before) return
    fillRefused.value = true
    clearTimeout(fillRefusedTimer)
    fillRefusedTimer = setTimeout(() => (fillRefused.value = false), REFUSED_PRESS_MS)
  })

  /** The tool's own pointer (ticket 542): not while the eyedropper, Space or a canvas move by another button
   * (the system's grab and grabbing) or the Frame's margin (not-allowed) has the pointer. Hand closes its hand while
   * it pans. */
  const toolCursor = computed(() => {
    const { tool, picking, markerHidden } = props.tools
    if (!tool || picking || markerHidden || overRefusedMargin.value || fillRefused.value) return undefined
    if (dragging.value && !handMoves.value) return undefined
    return toolPointer(tool, { color: props.previewColor, dragging: dragging.value })
  })

  /** The surface's cursor classes: the bead marker in place of the OS pointer, the eyedropper, the margin refused, and
   * the open and closed hand. */
  const surfaceClass = computed(() => {
    const { tool, picking, selects } = props.tools
    return {
      'project-surface--over-bead': overBead.value && !tool && !handMoves.value && !picking && !selects,
      'project-surface--picking': eyedropperShown.value,
      'project-surface--refused': (overRefusedMargin.value || fillRefused.value) && !handMoves.value,
      'project-surface--moving': handMoves.value,
      'project-surface--dragging': dragging.value,
    }
  })

  /** The CSS cursor that wins over the classes': the eyedropper, a handle's resize cursor, or the Tool pointer. */
  const cursorStyle = computed(() =>
    eyedropperShown.value ? { cursor: EYEDROPPER_CURSOR } : handleCursor.value ? { cursor: handleCursor.value } : toolCursor.value ? { cursor: toolCursor.value } : undefined,
  )

  /** Where a Pencil hovers (ticket 546), in client px, and whether it is the pointer that moves the canvas in the
   * input mode. None for a mouse, a finger or a Pencil in contact. */
  const penAt = ref<{ clientX: number; clientY: number; moves: boolean }>()

  /** The Tool pointer drawn for a hovering Pencil, which Safari shows no CSS cursor for: hot spot at the tip, nudged
   * `PEN_POINTER_NUDGE` up and left. Not where the CSS cursor is not the tool's (Set Frame, a handle, Space) or the tool
   * is refused (the Frame's margin, also when the canvas moves under a still Pencil). */
  const penPointer = computed(() => {
    const { tool, picking, markerHidden, settingFrame } = props.tools
    if (!penAt.value || settingFrame || markerHidden || handleCursor.value || refusesMargin(beadUnder(penAt.value))) return undefined
    // The pointer that moves the canvas in the input mode shows the Hand, whatever the tool; the others their own.
    const image = penAt.value.moves ? toolPointerImage('hand')
      : eyedropperShown.value ? EYEDROPPER_IMAGE
      : tool && !picking ? toolPointerImage(tool, { color: props.previewColor })
      : undefined
    const point = pointOnScreen(penAt.value)
    return image && { url: image.url, x: point.x - image.hotSpot[0] - PEN_POINTER_NUDGE, y: point.y - image.hotSpot[1] - PEN_POINTER_NUDGE }
  })

  function placePen(event: PointerEvent): void {
    const hovering = event.pointerType === 'pen' && event.buttons === 0 && !dragging.value && !framing.value && !adjusting.value
    penAt.value = hovering ? { clientX: event.clientX, clientY: event.clientY, moves: movesCanvas(event) } : undefined
  }

  /** The pointers down on the surface now: the Selection bar returns when the last one lifts (ticket 415). */
  const activePointers = new Set<number>()
  let wheeling = false
  let wheelTimer: ReturnType<typeof setTimeout> | undefined

  function onPress(event: PointerEvent) {
    // The right button holds the Selection bar away only once its drag is a pan (ticket 1074).
    if (event.button === 2) return
    holdBarAway(event.pointerId)
  }

  function holdBarAway(pointerId: number) {
    const was = activePointers.size > 0
    activePointers.add(pointerId)
    if (!was) emit('pressing', true)
  }

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

  /** Whether finished rows show their normal color (ticket 352): while hovered by mouse/Pencil, or toggled by a tap.
   * View only, not saved or Undo. */
  const hovered = ref(false)
  const finishedRestored = ref(false)
  const showFinished = computed(() => hovered.value || finishedRestored.value)
  /** Where a mouse or a Pencil last was over the surface, so the hover can be asked again when the Project moves under
   * it. */
  let hoverPoint: Pick<PointerEvent, 'clientX' | 'clientY'> | undefined

  function hoversFinishedRow(bead: GridPosition | undefined): boolean {
    return bead !== undefined && isInFinishedRow(props.project, bead)
  }

  // Where the bead-shaped marker stands for the pointer (ticket 353), in px from the surface's top-left: over beads,
  // for a mouse or hovering pen (OS pointer hidden). None with a canvas-moving tool, while the Frame is set, or for a
  // finger (no hover).
  const markerAt = ref<{ x: number; y: number; layer: ViewLayer }>()
  /** Whether the pointer last seen over the surface is one that draws and hovers: not a finger, not the one the input
   * mode keeps for moving the canvas. */
  let hoverDraws = false
  /** Whether that pointer is a hovering Pencil, whose marker stands off the tip so the hand does not cover it. */
  let hoverPen = false

  /** Puts the marker where the hovering pointer is, if it is over a bead it may place; asked again when the canvas
   * moves under a still pointer. */
  function placeMarker(): void {
    const bead = hoverPoint && hoverDraws && !dragging.value && !framing.value ? beadUnder(hoverPoint) : undefined
    if (!hoverPoint || !bead || refusesMargin(bead)) {
      markerAt.value = undefined
      return
    }
    const { x, y } = pointInDrawing(hoverPoint)
    const offset = hoverPen ? PEN_MARKER_OFFSET_PX : 0
    const side = props.handedness === 'left' ? 1 : -1
    markerAt.value = { x: x + side * offset, y: y - offset, layer: layerAt(props.project, bead) }
  }

  /** Takes the marker away, and keeps it away until the pointer moves again. */
  function hideMarker(): void {
    hoverDraws = false
    markerAt.value = undefined
  }

  // What is under a still pointer changes when the canvas moves or zooms, or the weaver's row does (Undo, the Progress
  // bar).
  watch([() => props.project, () => props.zoom, () => props.scroll], () => {
    placeMarker()
    if (hoverPoint) {
      hovered.value = hoversFinishedRow(beadUnder(hoverPoint))
    }
  })

  function beadUnder(event: Pick<PointerEvent, 'clientX' | 'clientY'>): GridPosition | undefined {
    if (!rootEl.value) {
      return undefined
    }
    const point = pointInDrawing(event)
    // The Select tool marks out a rectangle of a Custom frame's cells on screen, between its beads too (ticket 0594).
    return (props.tools.selectsAnywhere ? surface.value.frameCellAt(point) : undefined) ?? surface.value.pointToHit(point)
  }

  /** The color chip beside the eyedropper (ticket 403): what a press would take, live over beads; none over an empty
   * cell or for a finger. */
  const pickChip = ref<{ x: number; y: number; hex: string; flipX: boolean; flipY: boolean }>()

  function placePickChip(event: PointerEvent, bead: GridPosition | undefined): void {
    const shown = eyedropperShown.value && bead && event.pointerType !== 'touch' && !movesCanvas(event)
    const hex = shown ? beadColorAt(props.project, bead.row, bead.column, bead.layer) : null
    if (!hex || !rootEl.value) {
      pickChip.value = undefined
      return
    }
    const { x, y } = pointOnScreen(event)
    // Near the right or bottom edge the chip goes to the other side of the tip instead of being cut off.
    pickChip.value = { x, y, hex, flipX: x > size.value.width - PICK_CHIP_ROOM.x, flipY: y > size.value.height - PICK_CHIP_ROOM.y }
  }

  // A zoom, scroll or end of the pick leaves the chip showing a bead that is no longer under the pointer.
  watch(
    () => [eyedropperShown.value, props.zoom, props.scroll.x, props.scroll.y],
    () => {
      pickChip.value = undefined
    },
  )

  /** Whether a Selecting tool is in hand and the bead lies in the margin, which a Selection cannot start in (ticket
   * 428). */
  function refusesSelectionStart(bead: GridPosition): boolean {
    if (!props.tools.selects) return false
    // A Frame whose kind offers no Selection refuses one as the margin does (a Custom frame, ticket 0592), and so does
    // any Frame in Mirror mode: it mirrors whole (ADR 0082).
    return inMargin(footprintOf(props.project), bead) || (layerAt(props.project, bead) === 'frame' && (props.tools.marksArea || !frameAllows(frameOf(props.project), 'select')))
  }

  function refusesMargin(bead: GridPosition | undefined): boolean {
    if (bead === undefined) return false
    if (refusesSelectionStart(bead)) return true
    return props.tools.blocksMargin && !mayPlace(props.project, bead)
  }

  /** A bead's row and column for an event, and its layer only where the position alone would name the other one (ADR
   * 0066): where the Frame draws shorter than the rows it names. */
  function cellArguments(bead: GridPosition): [row: number, column: number, layer?: Layer] {
    const named = bead.layer
    return named && named !== layerAt(props.project, { row: bead.row, column: bead.column }) ? [bead.row, bead.column, named] : [bead.row, bead.column]
  }

  /** Whether this pointer is the one that moves the canvas in the input mode (ticket 325): Pen mode's finger and
   * mouse, Mouse mode's pen. */
  function movesCanvas(event: PointerEvent): boolean {
    return props.inputMode !== undefined && !pointerDraws(props.inputMode, event.pointerType)
  }

  /** A press that moves the canvas instead of drawing: the Hand tool (or Space), the middle button on any tool
   * (ticket 541), or the pointer the input mode keeps for moving. The right button's waits first (`rightPress`). */
  function startsDrag(event: PointerEvent): boolean {
    return handMoves.value || event.button === 1 || movesCanvas(event)
  }

  /** The right-button press in progress, under any tool (ticket 1074): where it went down, on screen, and what it is
   * so far by `pressBecomes`. It waits, then a drag is the middle button's pan and a click opens the Radial toolbox. */
  let rightPress: { id: number; x: number; y: number; is: CanvasPress } | undefined

  /** The drawing pointer's press while its hold is timed (ticket 1065), by `pressBecomes`: where it went down, on screen,
   * and the hold's timer. Once the hold has opened the ring it is `sliding` until it lifts, and no tool hears it. */
  let heldPress: { id: number; x: number; y: number; is: CanvasPress; timer: ReturnType<typeof setTimeout> } | undefined

  /** Starts timing a press's hold; the hairline shows where. */
  function timeHold(event: PointerEvent): void {
    clearTimeout(heldPress?.timer)
    heldPress = { id: event.pointerId, x: event.clientX, y: event.clientY, is: 'held', timer: setTimeout(completeHold, HOLD_MS) }
    emit('hold', { x: event.clientX, y: event.clientY })
  }

  /** What happened to the held press; once its hold is no longer timed the timer and the hairline go. */
  function stepHold(step: Exclude<CanvasPressStep, { type: 'down' }>): void {
    if (!heldPress) return
    const was = heldPress.is
    heldPress.is = pressBecomes(was, step)
    if (was === 'held' && heldPress.is !== 'held') {
      clearTimeout(heldPress.timer)
      emit('hold')
    }
    if (heldPress.is === 'nothing') heldPress = undefined
  }

  /** The hold is up: what the press started is dropped here and above, and the ring opens where it was pressed. The
   * pointer, still down, stays captured (the slide, ticket 1077). */
  function completeHold(): void {
    stepHold({ type: 'time', held: HOLD_MS })
    if (heldPress?.is !== 'sliding') return
    heldPointer = undefined
    stroke = undefined
    selectDrag = false
    dragging.value = false
    if (!rootEl.value?.hasPointerCapture?.(heldPress.id)) rootEl.value?.setPointerCapture?.(heldPress.id)
    emit('drop-press')
    openToolbox(heldPress)
  }
  watch(() => props.holdEnds, () => stepHold({ type: 'finger' }))

  /** Asks for the Radial toolbox at a point on screen, on the bead position under it whatever the tool. */
  function openToolbox(at: { x: number; y: number }): void {
    const hit = surface.value.pointToHit(pointInDrawing({ clientX: at.x, clientY: at.y }))
    const [row, column, layer] = hit ? cellArguments(hit) : []
    emit('open-toolbox', { x: at.x, y: at.y }, ...(row === undefined || column === undefined ? [] : [{ row, column, ...(layer ? { layer } : {}) }]))
  }

  /** The canvas follows the pointer from `from` (on screen) until the press ends; the hover and the marker go. */
  function startPan(from: { x: number; y: number }): void {
    dragging.value = true
    lastPoint = { x: from.x, y: from.y }
    lastBead = undefined
    overBead.value = false
    overRefusedMargin.value = false
    hideMarker()
  }

  /** The point of the viewport a pointer is at, in the surface's own px from its top-left corner (ticket 1071: the
   * Homepage draws its demo larger with CSS zoom). */
  function pointOnScreen(event: Pick<PointerEvent, 'clientX' | 'clientY'>): { x: number; y: number } {
    return ownPoint(rootEl.value, event)
  }

  /** The point of the drawing a pointer is at: on screen, turned back by the Canvas's lean (ticket 0672). */
  function pointInDrawing(event: Pick<PointerEvent, 'clientX' | 'clientY'>): { x: number; y: number } {
    return leaning.value.toDrawn(pointOnScreen(event))
  }

  /** The layer whose geometry a held press is measured in (ticket 492): the Frame's for its resize handles and a
   * Selection on it, the Canvas's for the Move handle and anything else. */
  let gestureLayer: ViewLayer = 'canvas'

  /** The bead position nearest a pointer, wherever it is: dragging a Frame needs one even between beads. */
  function cellUnder(event: PointerEvent, layer: ViewLayer = gestureLayer): GridPosition {
    return surface.value.pointToCell(pointInDrawing(event), layer)
  }

  /** Whether the Mirror's Canvas Area's handles take a press (no Selection holds them): under any tool that draws, so
   * a Paint or Fill press on one moves the Area, places no bead. Inside it is the tool's, but in Mirror mode (Select)
   * the whole Area grabs (ADR 0082). */
  const areaGrab = computed(() => {
    const { moves, picking, settingFrame } = props.tools
    return !props.selection && props.mirror?.place?.layer === 'canvas' && !moves && !picking && !settingFrame
  })

  /** What the handles grab: the Selection, or else the Mirror's Canvas Area. */
  const grabbed = computed<Selection | undefined>(() => {
    if (props.selection || !areaGrab.value || props.mirror?.place?.layer !== 'canvas') return props.selection
    const { row, column, rows, columns } = props.mirror.place.area
    return { top: row, left: column, rows, columns, layer: 'canvas' }
  })

  /** Whether the held handles are the Mirror's Area's, outside Mirror mode: only its handles take a press. */
  const areaHandlesOnly = computed(() => areaGrab.value && !props.tools.marksArea)

  // A Selection cleared or an Area closed takes its hot corner with it, so the next one starts plain.
  watch(() => grabbed.value === undefined, (gone) => {
    if (gone) hotAreaHandle.value = undefined
  })

  /** The layer a Selection acts on, for measuring a press on its handles. */
  function selectionViewLayer(): ViewLayer {
    return grabbed.value ? selectionLayer(props.project, grabbed.value) : 'canvas'
  }

  /** What a press grabs of the Frame's chrome (ticket 452): a resize handle, only while edit is on; nothing otherwise,
   * so the tool gets the press. The Move handle's own press comes through `pressMoveHandle`. */
  function framePress(event: PointerEvent, touch = touchInput.value): FramePress | undefined {
    const point = pointInDrawing(event)
    if (!props.tools.settingFrame) return undefined
    const target = framePressAt(frameOf(props.project), surface.value, quarterTurnOf(props.project), point, touch)
    return target.kind === 'handle' ? target : undefined
  }

  /** A Select drag in progress (ticket 505): every move reports the nearest bead position, over a bead or not, in the
   * geometry of the layer it began on. */
  let selectDrag = false
  let selectLayer: ViewLayer = 'canvas'

  /** How far the middle of the bead a Frame drag was pressed on is from the press, in viewport pixels (ticket 0977):
   * a resize drag reads its beads from there, so an edge moves once the pointer has gone half a bead, not as soon as a
   * press on the line between two beads wobbles across it. Nothing for the Move handle. */
  let frameGrip = { x: 0, y: 0 }

  /** Reports the cell at `point` to whichever drag is held: a Frame's, a Selection's adjust or a Select drag. */
  function followHeldDrag(point: { x: number; y: number }): void {
    if (framing.value) emit('frame-drag', surface.value.pointToCell({ x: point.x + frameGrip.x, y: point.y + frameGrip.y }, gestureLayer))
    else if (adjusting.value) emit('selection-drag', surface.value.pointToCell(point, gestureLayer))
    else if (selectDrag) {
      const near = surface.value.pointToCell(point, selectLayer)
      emit('cell-primary-move', near.row, near.column)
    }
  }

  /** Whether a pointer is a finger or a Pencil: on a tablet it cannot go past the canvas box's edge, the glass's
   * (ticket 0805). */
  function onGlass(pointerType: string): boolean {
    return pointerType === 'touch' || pointerType === 'pen'
  }

  /** A Select drag by a finger or a Pencil that ended at the edge of the glass (ticket 0805): iPadOS ends a touch that
   * slides onto the bezel, and one sliding back on is a new press, which would land inside the Selection and move it.
   * A press of the same pointer kind at the same edge soon after picks the drag back up instead. */
  let offTheGlass: { kind: SelectionDragKind; pointerType: string; edges: FrameEdge[]; at: number; layer: ViewLayer; selection: Selection } | undefined
  /** Whether the Selection press in progress grabbed a handle: a resize, which can be picked back up. */
  let resizing = false
  /** The Selection when the press in progress began: a drag that leaves it as it was made nothing (a stamp in paste
   * mode, a refused one) and is not picked back up. */
  let selectionAtPress: Selection | undefined

  /** The edges of the canvas box a point is within `px` of. */
  function edgesNear(event: Pick<PointerEvent, 'clientX' | 'clientY'>, px: number): FrameEdge[] {
    const { x, y } = pointOnScreen(event)
    const { width, height } = size.value
    const distances: Record<FrameEdge, number> = { left: x, top: y, right: width - x, bottom: height - y }
    return (Object.keys(distances) as FrameEdge[]).filter((edge) => distances[edge] <= px)
  }

  /** Notes a Select drag ending where the finger left the glass; anything else forgets one. */
  function noteOffTheGlass(): void {
    const kind: SelectionDragKind | undefined = selectDrag ? 'mark' : adjusting.value && resizing ? 'resize' : undefined
    const edges = heldPointer && onGlass(heldPointer.pointerType) ? edgesNear(heldPointer, OFF_THE_GLASS_PX) : []
    offTheGlass =
      kind && heldPointer && edges.length > 0 && props.selection && props.selection !== selectionAtPress
        ? { kind, pointerType: heldPointer.pointerType, edges, at: performance.now(), layer: kind === 'mark' ? selectLayer : gestureLayer, selection: props.selection }
        : undefined
  }

  /** Picks the drag that slid off the glass back up, if this press is its finger coming back; returns whether it did. */
  function resumeOffTheGlass(event: PointerEvent): boolean {
    const left = offTheGlass
    offTheGlass = undefined
    const back =
      left !== undefined &&
      event.button === 0 &&
      event.isPrimary &&
      event.pointerType === left.pointerType &&
      performance.now() - left.at <= BACK_ON_THE_GLASS_MS &&
      props.selection === left.selection &&
      props.tools.selects &&
      (left.kind === 'resize' || props.tools.selectsAnywhere) &&
      !startsDrag(event) &&
      edgesNear(event, BACK_ON_THE_GLASS_PX).some((edge) => left.edges.includes(edge))
    if (!back) return false
    if (left.kind === 'mark') {
      selectDrag = true
      selectLayer = left.layer
    } else {
      adjusting.value = true
      resizing = true
      gestureLayer = left.layer
    }
    hideMarker()
    rootEl.value?.setPointerCapture?.(event.pointerId)
    emit('selection-resume', left.kind)
    dragTo(event)
    event.preventDefault()
    return true
  }

  /** While a Frame or a Selection is dragged with the pointer at the edge (ticket 0660), the view scrolls toward it
   * each frame and the drag follows (the pointer is still, so no move event would say so). */
  let heldPointer: Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerType'> | undefined
  let edgeScrollFrame = 0
  function edgeScrollTick(): void {
    edgeScrollFrame = 0
    if (!framing.value && !adjusting.value && !selectDrag) {
      heldPointer = undefined
      return
    }
    if (!heldPointer) return
    const point = pointInDrawing(heldPointer)
    const { dx, dy } = edgeScrollStep(pointOnScreen(heldPointer), size.value, onGlass(heldPointer.pointerType))
    if (dx !== 0 || dy !== 0) {
      emit('pan', -dx, -dy)
      // After the parent has applied the pan, so the cell under the still pointer is the new one.
      void nextTick(() => followHeldDrag(point))
    }
    edgeScrollFrame = requestAnimationFrame(edgeScrollTick)
  }

  /** Moves a held drag to the pointer and keeps the edge scroll following it, starting the frame loop if it isn't
   * running. */
  function dragTo(event: Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerType'>): void {
    heldPointer = { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType }
    if (!edgeScrollFrame && typeof requestAnimationFrame === 'function') edgeScrollFrame = requestAnimationFrame(edgeScrollTick)
    followHeldDrag(pointInDrawing(event))
  }

  /** A press on the Move handle's button over the canvas (ticket 455): the same grab as a press on the handle itself. */
  function pressMoveHandle(event: PointerEvent): void {
    if (!frameOf(props.project) || event.button !== 0) return
    touchInput.value = event.pointerType === 'touch'
    onPress(event)
    framing.value = true
    hideMarker()
    rootEl.value?.setPointerCapture?.(event.pointerId)
    gestureLayer = 'canvas'
    frameGrip = { x: 0, y: 0 }
    emit('frame-press', { kind: 'move' }, cellUnder(event))
    event.preventDefault()
  }

  /** A press on the move grip of an area's bar (ticket 0808): the drag a press inside the area starts, whatever
   * the tool, with no tap at its end. A Piece's shape has the grip too, and its beads go with it (ticket 1013). */
  function pressAreaGrip(event: PointerEvent, area: SheetArea): void {
    const place = props.mirror?.place
    const layer = area === 'selection' ? props.selection && selectionLayer(props.project, props.selection) : place?.layer === 'canvas' && 'canvas'
    if (!layer || event.button !== 0) return
    touchInput.value = event.pointerType === 'touch'
    onPress(event)
    adjusting.value = true
    resizing = false
    selectionAtPress = props.selection
    hideMarker()
    rootEl.value?.setPointerCapture?.(event.pointerId)
    gestureLayer = layer
    emit('selection-press', { kind: 'inside' }, cellUnder(event), area)
    event.preventDefault()
  }

  /** The press-to-release stroke (ticket 504): holes and empty background neither end it nor need a bead to resume. */
  let stroke: { from: { x: number; y: number }; last: GridPosition | undefined } | undefined

  function onPointerDown(event: PointerEvent): void {
    penAt.value = undefined
    touchInput.value = event.pointerType === 'touch'
    // A pinch moves the view itself: the edge scroll stops following the first finger.
    if (event.pointerType === 'touch' && !event.isPrimary) {
      heldPointer = undefined
      stepHold({ type: 'finger' })
    }
    if (frameOf(props.project) && event.pointerType === 'touch' && !event.isPrimary) {
      // A second finger is a pinch (usePinchPan): whatever the first was dragging is let go, uncommitted.
      if (framing.value) {
        framing.value = false
        emit('frame-cancel')
      }
      return
    }
    // The right button's press waits to be a pan or a click (ticket 1074): no tool or handle gets it.
    const press = pressBecomes(undefined, { type: 'down', button: event.button, pointerType: event.pointerType, inputMode: props.inputMode })
    if (press === 'waits') {
      rightPress = { id: event.pointerId, x: event.clientX, y: event.clientY, is: press }
      rootEl.value?.setPointerCapture?.(event.pointerId)
      event.preventDefault()
      return
    }
    if (resumeOffTheGlass(event)) return
    selectionAtPress = props.selection
    if (frameOf(props.project) && !startsDrag(event) && event.button === 0) {
      const target = framePress(event)
      if (target) {
        framing.value = true
        hotHandle.value = frameHandleIdAt(frameOf(props.project), surface.value, pointInDrawing(event), touchInput.value)
        hideMarker()
        rootEl.value?.setPointerCapture?.(event.pointerId)
        gestureLayer = target.kind === 'handle' ? 'frame' : 'canvas'
        const pressed = cellUnder(event)
        const point = pointInDrawing(event)
        const middle = surface.value.beadToPoint(pressed, gestureLayer)
        frameGrip = { x: middle.x - point.x, y: middle.y - point.y }
        emit('frame-press', target, pressed)
        event.preventDefault()
        return
      }
    }
    const held = grabbed.value
    if ((props.tools.selects || areaGrab.value) && held && event.button === 0 && !(event.pointerType === 'touch' && !event.isPrimary) && !startsDrag(event)) {
      // A Selection too small for handles (ticket 435) has none to grab: a press inside it only moves it. A shape
      // (ticket 547) can't be grabbed at all.
      const box = surface.value.beadBox(selectionFrame(held), selectionViewLayer())
      const point = pointInDrawing(event)
      const found: FramePress = held.cells
        ? { kind: 'outside' }
        : selectionHasHandles(held)
          ? areaPressAt(box, quarterTurnOf(props.project), point, touchInput.value, AREA_SHEET_OUTSET)
          : { kind: pointInBox(box, point) ? 'inside' : 'outside' }
      const target: FramePress = areaHandlesOnly.value && found.kind !== 'handle' ? { kind: 'outside' } : found
      if (target.kind !== 'outside') {
        adjusting.value = true
        resizing = target.kind === 'handle'
        hotAreaHandle.value = resizing ? handleIdAt(box, point, touchInput.value, AREA_SHEET_OUTSET) : undefined
        hideMarker()
        rootEl.value?.setPointerCapture?.(event.pointerId)
        gestureLayer = selectionViewLayer()
        emit('selection-press', target, cellUnder(event), ...(areaHandlesOnly.value ? ['mirror' as const] : []))
        event.preventDefault()
        return
      }
    }
    // No handle took the press: the drawing pointer's hold is timed while its tool starts (ticket 1065). Not a second
    // finger's, nor the press Pick color from Canvas waits for, which takes its colour at once.
    if (press === 'held' && props.holdOpens && !props.tools.picking && !(event.pointerType === 'touch' && !event.isPrimary)) timeHold(event)
    if (startsDrag(event)) {
      startPan({ x: event.clientX, y: event.clientY })
      rootEl.value?.setPointerCapture?.(event.pointerId)
      event.preventDefault()
      return
    }

    // A ruler number is display-only (ticket 447): the press goes to the active tool at that spot.
    const bead = beadUnder(event)
    overBead.value = bead !== undefined
    const offShape = !bead && surface.value.offShapeAt(pointInDrawing(event))
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
        if (props.tools.nearestOnPress || props.tools.selectsAnywhere) {
          const near = cellUnder(event, 'canvas')
          if (props.tools.selectsAnywhere) {
            selectDrag = true
            selectLayer = 'canvas'
            rootEl.value?.setPointerCapture?.(event.pointerId)
          }
          emit('cell-primary-down', near.row, near.column)
        } else {
          stroke = { from: pointInDrawing(event), last: undefined }
        }
      }
      return
    }
    if (event.button === 0) {
      stroke = { from: pointInDrawing(event), last: bead }
    }
    // A press also lands where the pasted block under the pointer goes (the preview cells).
    const pasted = [...(props.previewCells ?? []), ...(props.previewStamp ? stampCells(props.previewStamp) : [])]
    if (event.button === 0 && (refusesMargin(bead) || pasted.some((cell) => refusesMargin(cell)))) {
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
      if (props.tools.selects) rootEl.value?.setPointerCapture?.(event.pointerId)
      selectDrag = props.tools.selectsAnywhere
      selectLayer = bead.layer === 'frame' ? 'frame' : 'canvas'
      // A press on a finished row never draws (the lock), and, while its dimming shows, toggles the finished rows
      // between dimmed and normal.
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
    if (rightPress?.is === 'waits' && event.pointerId === rightPress.id) {
      rightPress.is = pressBecomes(rightPress.is, { type: 'move', moved: Math.hypot(event.clientX - rightPress.x, event.clientY - rightPress.y) })
      // The pan starts from where the button went down, so the bead pressed stays under the pointer.
      if (rightPress.is === 'pan') {
        holdBarAway(rightPress.id)
        startPan(rightPress)
      }
    }
    if (event.pointerId === heldPress?.id) {
      stepHold({ type: 'move', moved: Math.hypot(event.clientX - heldPress.x, event.clientY - heldPress.y) })
      // The ring is open under a pointer still down: its moves are not the tool's.
      if (heldPress.is === 'sliding') return
    }
    if (adjusting.value) {
      dragTo(event)
      return
    }
    const held = grabbed.value
    if ((props.tools.selects || areaGrab.value) && held && event.pointerType !== 'touch' && selectionHasHandles(held)) {
      const id = handleIdAt(surface.value.beadBox(selectionFrame(held), selectionViewLayer()), pointInDrawing(event), false, AREA_SHEET_OUTSET)
      hotAreaHandle.value = id
      handleCursor.value = id ? HANDLE_CURSORS[id] : undefined
    } else if (frameOf(props.project) && event.pointerType !== 'touch' && !framing.value) {
      hotAreaHandle.value = undefined
      const target = framePress(event)
      hotHandle.value = target?.kind === 'handle' ? frameHandleIdAt(frameOf(props.project), surface.value, pointInDrawing(event), false) : undefined
      handleCursor.value = target?.kind === 'move' ? 'grab' : hotHandle.value ? HANDLE_CURSORS[hotHandle.value] : undefined
    } else {
      hotAreaHandle.value = undefined
      handleCursor.value = undefined
    }
    if (framing.value) {
      dragTo(event)
      return
    }
    if (dragging.value) {
      emit('pan', ownLength(rootEl.value, event.clientX - lastPoint.x), ownLength(rootEl.value, event.clientY - lastPoint.y))
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
    overRefusedMargin.value = refusesMargin(bead) || (!bead && surface.value.offShapeAt(pointInDrawing(event)))
    placeMarker()
    placePickChip(event, bead)
    if (selectDrag && event.buttons & 1) {
      dragTo(event)
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

  /** Reports every bead on the straight line from the stroke's last sample to the pointer, found in position space,
   * all in one report (ticket 0674). */
  function continueStroke(event: PointerEvent): void {
    if (!stroke) return
    if (!(event.buttons & 1)) {
      stroke = undefined
      return
    }
    const to = pointInDrawing(event)
    const { x, y } = stroke.from
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - x, to.y - y) / STROKE_SAMPLE_PX))
    const crossed: GridPosition[] = []
    for (let step = 1; step <= steps; step++) {
      const bead = surface.value.pointToHit({ x: x + ((to.x - x) * step) / steps, y: y + ((to.y - y) * step) / steps })
      if (!bead || isSameBead(bead, stroke.last)) continue
      const first = stroke.last === undefined
      stroke.last = bead
      if (first) emit('cell-primary-down', ...cellArguments(bead))
      else {
        const [row, column, layer] = cellArguments(bead)
        crossed.push(layer ? { row, column, layer } : { row, column })
      }
    }
    stroke.from = to
    if (crossed.length > 0) emit('cells-primary-move', crossed)
  }

  function onPointerEnd(event?: PointerEvent): void {
    if (selectDrag || adjusting.value) noteOffTheGlass()
    if (!event || event.pointerId === rightPress?.id) {
      // A right click (lifted while it waited) opens the Radial toolbox where it was pressed (ticket 1064).
      if (event?.type === 'pointerup' && rightPress && pressBecomes(rightPress.is, { type: 'lift' }) === 'ring') openToolbox(rightPress)
      rightPress = undefined
    }
    // Capturing the sliding pointer takes it from the element it went down on: that loss is not its lift.
    const recaptured = event?.type === 'lostpointercapture' && heldPress?.is === 'sliding'
    if (!event || (event.pointerId === heldPress?.id && !recaptured)) stepHold({ type: 'lift' })
    heldPointer = undefined
    resizing = false
    stroke = undefined
    selectDrag = false
    releasePointer(event)
    dragging.value = false
    if (adjusting.value) {
      adjusting.value = false
      // A finger has no hover to keep a handle hot once it lifts.
      if (event?.pointerType === 'touch') hotAreaHandle.value = undefined
      emit('selection-release')
    }
    if (framing.value) {
      framing.value = false
      // A finger has no hover to keep a handle hot once it lifts.
      if (event?.pointerType === 'touch') hotHandle.value = undefined
      emit('frame-release')
    }
  }

  /** A cancelled pointer is a pen gone out of range or a gesture taken over: it has no marker to show. */
  function onPointerCancel(): void {
    penAt.value = undefined
    hotAreaHandle.value = undefined
    onPointerEnd()
    hideMarker()
  }

  function onPointerLeave(): void {
    penAt.value = undefined
    if (!framing.value) hotHandle.value = undefined
    if (!adjusting.value) hotAreaHandle.value = undefined
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
    const dx = wheelPx(event.deltaX, event.deltaMode)
    const dy = wheelPx(event.deltaY, event.deltaMode)
    if (event.ctrlKey || event.metaKey) {
      const step = Math.max(-30, Math.min(30, dy))
      emit('zoom-by', Math.exp(-step * 0.01), pointOnScreen(event))
      return
    }
    const sideways = event.shiftKey && dx === 0
    // A wheel in px moves the drawing as far on screen; one in lines or pages, by the surface's own lines or pages.
    const own = (delta: number) => (event.deltaMode === 0 ? ownLength(rootEl.value, delta) : delta)
    emit('scroll', own(sideways ? dy : dx), own(sideways ? 0 : dy))
  }

  onMounted(() => {
    window.addEventListener('blur', dropPressedPointers)
    window.addEventListener('pointerup', onWindowPointerEnd)
    window.addEventListener('pointercancel', onWindowPointerEnd)
  })

  onBeforeUnmount(() => {
    clearTimeout(fillRefusedTimer)
    clearTimeout(wheelTimer)
    clearTimeout(heldPress?.timer)
    if (edgeScrollFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(edgeScrollFrame)
    window.removeEventListener('blur', dropPressedPointers)
    window.removeEventListener('pointerup', onWindowPointerEnd)
    window.removeEventListener('pointercancel', onWindowPointerEnd)
  })

  return {
    /** The root's handlers, bound by the template. */
    handlers: { onPress, onPointerDown, onPointerMove, onPointerEnd, onPointerCancel, onPointerLeave, onWheel },
    surfaceClass,
    cursorStyle,
    penPointer,
    pickChip,
    markerAt,
    framing,
    touchInput,
    hotHandle,
    hotAreaHandle,
    showFinished,
    pressMoveHandle,
    pressAreaGrip,
  }
}
