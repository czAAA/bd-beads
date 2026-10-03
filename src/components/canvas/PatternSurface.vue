<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import type { Frame } from '../../domain/canvas'
import type { GridPosition, PreviewCell } from '../../domain/grid'
import type { MirrorAxisCounts } from '../../domain/mirror'
import { changedPositions, type Pattern } from '../../domain/pattern'
import type { Selection } from '../../domain/selection'
import { PATTERN_THEMES, type PatternTheme } from '../../rendering/beadLook'
import type { Scroll } from '../../rendering/canvasView'
import { renderCanvas } from '../../rendering/canvasRenderer'
import { framePressAt, type FramePress } from '../../rendering/frameHandles'
import { beadAtOpen, cellAtOpen } from '../../rendering/hitTest'
import { renderOverlay, type TourMarks } from '../../rendering/overlayRenderer'
import { labelAt, visibleRulerLabels } from '../../rendering/rulers'
import { useResolvedTheme } from '../../theme/useResolvedTheme'

/**
 * The open canvas drawn by the canvas renderer (ADR 0018, ADR 0026): the Drawing surface of CONTEXT.md. It fills the
 * drawing area edge to edge with two canvases the size of what is on screen, one for the beads and the dots round them
 * and one over it for what comes and goes with a tool or the pointer (see overlayRenderer). There is no board, no edge
 * and no scroll container: what is shown is decided by the `scroll` and the `zoom` it is given, so a canvas of any size
 * costs what is in view and no more.
 *
 * It also reads the gestures that move the view — the wheel and Ctrl/⌘ + wheel, a drag with the Hand tool or the middle
 * button — and reports them, leaving the view itself to its owner (useCanvasView).
 */
const props = defineProps<{
  pattern: Pattern
  /** How much the canvas is enlarged by; 1 is a bead 20 px across. */
  zoom: number
  /** Where the viewport's top-left corner is, in displayed px from the bead at row 0, column 0 (see canvasView). */
  scroll: Scroll
  /** Beads to show a hover preview on (ticket 23): the hovered bead and its live-mirror counterparts, or a whole copied block under the cursor (ticket 31). */
  previewCells?: PreviewCell[]
  /** The color to preview, faintly, on beads that carry none of their own; null for a neutral outline when no Palette color is selected. */
  previewColor?: string | null
  /** The rectangle the Select tool has marked out, drawn as a marquee over those beads (ticket 31). */
  selection?: Selection
  /** Mirror's per-direction axis counts (ticket 44): axis lines are drawn whenever a direction's count is above 0. */
  mirrorAxisCounts?: MirrorAxisCounts
  /** Beads a hovered "Mirror current" button would overwrite (ticket 47): drawn faded. */
  dimmedCells?: GridPosition[]
  /** The keyboard's bead cursor (ticket 159), drawn only while the surface has keyboard focus. */
  cursor?: GridPosition
  /** What the Tour marks on the Pattern (ticket 80), drawn dashed over the beads. */
  tourMarks?: TourMarks
  /** The Pattern's accessible name: it is one image to a screen reader, summed up (ScreenReaders card). */
  label?: string
  /** Whether a drag moves the canvas instead of drawing (the Hand tool, or Space held). */
  moving?: boolean
  /** Whether ruler numbers are drawn (the Rulers toggle); the lines they hang from are drawn either way. */
  showRulers?: boolean
  /** The Piece being drawn now, whose rectangle is drawn `muted` rather than `line-strong` (BeadBoard card). */
  activePiece?: Frame
  /** Whether the Frame is being set (Set Frame): a drag draws, moves or resizes it instead of drawing beads, and its handles show. */
  settingFrame?: boolean
  /** The size tooltip's text at the Frame's corner while it is being set ("13×13 · 2.1 × 2.1 cm"). */
  frameTooltip?: string
}>()

const emit = defineEmits<{
  'cell-primary-down': [row: number, column: number]
  'cell-primary-move': [row: number, column: number]
  'cell-secondary-down': [row: number, column: number]
  'cell-secondary-move': [row: number, column: number]
  'cell-hover': [row: number, column: number]
  'hover-end': []
  /** A key pressed while the Pattern has focus (ticket 159): App.vue moves the bead cursor and uses the tool. */
  'cursor-key': [event: KeyboardEvent]
  /** Keyboard focus arrived (true) or left (false): the cursor shows only after focus by keyboard. */
  'keyboard-focus': [focused: boolean]
  /** The canvas was dragged by this many px (the Hand tool, the middle button). */
  pan: [dx: number, dy: number]
  /** The wheel or a trackpad scrolled the canvas by this many px. */
  scroll: [dx: number, dy: number]
  /** Ctrl/⌘ + wheel (or a trackpad pinch) asked to change the zoom by this factor about a point of the viewport. */
  'zoom-by': [factor: number, anchor: Scroll]
  /** A ruler number was pressed: the whole row or column it numbers is to be selected. */
  'select-line': [selection: Selection]
  /** Set Frame: a press grabbed a handle, the inside of the Frame or the open canvas, at this bead position. */
  'frame-press': [target: FramePress, cell: GridPosition]
  /** Set Frame: the pointer moved with the press held, over this bead position. */
  'frame-drag': [cell: GridPosition]
  /** Set Frame: the press ended. */
  'frame-release': []
  /** Set Frame: a second finger landed, so the press was a pinch, not a drag: drop what was dragged. */
  'frame-cancel': []
}>()

/**
 * Set by a press on the surface: a press focuses it too, but the bead cursor shows only for focus that didn't come from
 * a pointer (Tab, or Skip to Pattern).
 */
let pressed = false

function onPress() {
  pressed = true
}

function onFocus() {
  if (!pressed) emit('keyboard-focus', true)
}

function onBlur() {
  pressed = false
  emit('keyboard-focus', false)
}

/** The colors the beads are drawn in follow the app's theme; a change redraws both layers. */
const resolvedTheme = useResolvedTheme()
const theme = computed(() => PATTERN_THEMES[resolvedTheme.value])

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
let drawn: { pattern: Pattern; zoom: number; scroll: Scroll; width: number; height: number; pixelRatio: number; theme: PatternTheme } | undefined

/** Whether two Patterns are laid out and dimmed alike, so that what differs between them is only which color each bead holds. */
function sameLayout(a: Pattern, b: Pattern): boolean {
  const progress = (pattern: Pattern) => pattern.rowProgress
  return (
    a.technique === b.technique &&
    a.frame === b.frame &&
    a.rotation === b.rotation &&
    progress(a).enabled === progress(b).enabled &&
    progress(a).direction === progress(b).direction &&
    progress(a).currentRow === progress(b).currentRow &&
    progress(a).currentColumn === progress(b).currentColumn
  )
}

/** Past this many changed rows, drawing them one band at a time costs more than drawing the lot. */
const MOST_ROWS_WORTH_A_BAND = 40

/**
 * The bands of rows an edit changed, for drawing just those: rows apart by no more than two share a band, since a row's
 * neighbours are drawn with it anyway. Empty when nothing changed; undefined when so much did (an Undo, a Fill, a Mirror
 * current) that drawing it all again is the cheaper way.
 */
function changedBands(before: Pattern, after: Pattern): { first: number; last: number }[] | undefined {
  const changed = [...new Set(changedPositions(before.beads, after.beads).map((position) => position.row))].sort((x, y) => x - y)
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

/** Sizes a canvas to the surface and the screen's pixel density, leaving it alone (and its drawing with it) when it already is. Whether it had to change. */
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

/** Draws the beads: all of them in view, or, when an edit changed only some rows of what is already drawn, just those. */
function drawCells(): void {
  const canvas = baseEl.value
  if (!canvas || size.value.width === 0 || size.value.height === 0) {
    return
  }

  const pixelRatio = globalThis.devicePixelRatio || 1
  const region = currentRegion()
  const pattern = toRaw(props.pattern)
  const resized = sizeCanvas(canvas, region.width, region.height, pixelRatio)
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  const before = drawn
  drawn = { pattern, zoom: props.zoom, scroll: { ...props.scroll }, width: region.width, height: region.height, pixelRatio, theme: theme.value }
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
    sameLayout(before.pattern, pattern)
      ? changedBands(before.pattern, pattern)
      : undefined

  if (bands === undefined) {
    renderCanvas(context, { pattern, region, zoom: props.zoom, pixelRatio, theme: theme.value })
    return
  }
  for (const rows of bands) {
    renderCanvas(context, { pattern, region, zoom: props.zoom, pixelRatio, rows, theme: theme.value })
  }
}

/** The numbers' size: 11px, 12px on a phone (Rulers card). */
function rulerFontPx(): number {
  return window.innerWidth <= 743 ? 12 : 11
}

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
      pattern: toRaw(props.pattern),
      region,
      zoom: props.zoom,
      pixelRatio,
      theme: theme.value,
      open: true,
      cursor: props.cursor,
      preview: props.previewCells && props.previewCells.length > 0 ? { cells: props.previewCells, color: props.previewColor ?? null } : undefined,
      selection: props.selection,
      mirrorAxisCounts: props.mirrorAxisCounts,
      dimmedCells: props.dimmedCells,
      tourMarks: props.tourMarks,
      frameEditing: props.settingFrame ? { touch: touchInput.value, tooltip: props.frameTooltip ?? '' } : undefined,
      rulers: {
        numbers: props.showRulers ?? true,
        fontPx: rulerFontPx(),
        viewport: size.value,
        activePiece: props.activePiece,
      },
    })
  }
}

// The Pattern is replaced whole by every edit, so its identity is all that needs watching: a deep watch would make the
// draw depend on every bead's property.
watch([size, () => props.pattern, () => props.zoom, () => props.scroll, theme], drawCells, { flush: 'post' })
watch(
  [
    size,
    () => props.pattern,
    () => props.zoom,
    () => props.scroll,
    () => props.previewCells,
    () => props.previewColor,
    () => props.selection,
    () => props.mirrorAxisCounts,
    () => props.dimmedCells,
    () => props.cursor,
    () => props.tourMarks,
    () => props.showRulers,
    () => props.settingFrame,
    () => props.frameTooltip,
    () => props.activePiece,
    touchInput,
    theme,
  ],
  drawOverlay,
  { flush: 'post' },
)

/**
 * Pointer events (ticket 60), not mouse events, so a paint or erase stroke works the same by mouse, touch and pen. The
 * surface is one element, so which bead a pointer is on is worked out from where it is (see beadAtOpen) instead of being
 * told by the bead's own element; and, as an element's pointerenter did, only a change of bead is news. A touch or pen
 * contact keeps its implicit capture on the surface, so the moves of a stroke go on arriving here.
 */
const overBead = ref(false)
const dragging = ref(false)
/** Whether a Frame gesture is in progress (a press that grabbed the Frame or drew a new one). */
const framing = ref(false)
let lastBead: GridPosition | undefined
let lastPoint = { x: 0, y: 0 }

function beadUnder(event: PointerEvent): GridPosition | undefined {
  const root = rootEl.value
  if (!root) {
    return undefined
  }
  const box = root.getBoundingClientRect()
  return beadAtOpen(
    { technique: props.pattern.technique, rotation: props.pattern.rotation },
    { x: event.clientX - box.left + props.scroll.x, y: event.clientY - box.top + props.scroll.y },
    props.zoom,
  )
}

function isSameBead(a: GridPosition | undefined, b: GridPosition | undefined): boolean {
  return a?.row === b?.row && a?.column === b?.column
}

/**
 * A finger has no true hover, so its every "hover" arrives glued to a press or a drag -- one bead flashed a preview
 * of what a same-instant paint already shows. Suppressing it there is `responsive.md`'s "no hover paint preview" for
 * a coarse pointer; a Pencil keeps its real hover, and a mouse or trackpad was never touch to begin with.
 */
function hoversFor(event: PointerEvent): boolean {
  return event.pointerType !== 'touch'
}

/** A press that moves the canvas instead of drawing: the Hand tool (or Space), or the middle button on any tool. */
function startsDrag(event: PointerEvent): boolean {
  return props.moving === true || event.button === 1
}

/** The point of the viewport a pointer is at, in px from its top-left corner. */
function pointInSurface(event: PointerEvent): { x: number; y: number } {
  const box = rootEl.value?.getBoundingClientRect()
  return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
}

/** The bead position nearest a pointer, wherever it is: dragging a Frame needs one even between beads. */
function cellUnder(event: PointerEvent): GridPosition {
  const point = pointInSurface(event)
  return cellAtOpen({ technique: props.pattern.technique, rotation: props.pattern.rotation }, { x: point.x + props.scroll.x, y: point.y + props.scroll.y }, props.zoom)
}

function onPointerDown(event: PointerEvent): void {
  touchInput.value = event.pointerType === 'touch'
  if (props.settingFrame && event.pointerType === 'touch' && !event.isPrimary) {
    // A second finger is a pinch (usePinchPan): whatever the first was dragging is let go, uncommitted.
    if (framing.value) {
      framing.value = false
      emit('frame-cancel')
    }
    return
  }
  if (props.settingFrame && !startsDrag(event) && event.button === 0) {
    framing.value = true
    rootEl.value?.setPointerCapture?.(event.pointerId)
    const target = framePressAt(props.pattern.frame, { technique: props.pattern.technique, rotation: props.pattern.rotation, zoom: props.zoom, scroll: props.scroll }, pointInSurface(event), touchInput.value)
    emit('frame-press', target, cellUnder(event))
    event.preventDefault()
    return
  }
  if (startsDrag(event)) {
    dragging.value = true
    lastPoint = { x: event.clientX, y: event.clientY }
    lastBead = undefined
    overBead.value = false
    rootEl.value?.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    return
  }

  // A ruler number selects its whole row or column, from any tool, instead of reaching the beads under it.
  if (event.button === 0) {
    const box = rootEl.value?.getBoundingClientRect()
    // The numbers are laid out again for the press, from the same maths that drew them. A surface not yet measured (no layout) has no edge to cut them at.
    const viewport = size.value.width > 0 ? size.value : { width: Infinity, height: Infinity }
    const labels =
      props.showRulers === false
        ? []
        : visibleRulerLabels(toRaw(props.pattern), { technique: props.pattern.technique, rotation: props.pattern.rotation, zoom: props.zoom, scroll: props.scroll, viewport, fontPx: rulerFontPx() })
    const label = labelAt(labels, { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) })
    if (label) {
      emit('select-line', label.selection)
      return
    }
  }

  const bead = beadUnder(event)
  overBead.value = bead !== undefined
  if (!bead) {
    lastBead = undefined
    return
  }

  // A touch has not been over the bead before it lands on it: the hover comes first, as the bead's pointerenter did.
  if (!isSameBead(bead, lastBead)) {
    lastBead = bead
    if (hoversFor(event)) emit('cell-hover', bead.row, bead.column)
  }

  if (event.button === 0) {
    emit('cell-primary-down', bead.row, bead.column)
  } else if (event.button === 2) {
    emit('cell-secondary-down', bead.row, bead.column)
  }
}

/**
 * Reports the hover for the preview, plus a drag move when a button is held: primary continues a paint/fill stroke
 * (ticket 24), secondary an erase stroke (ticket 25). `buttons` reads 1 for a touch/pen still in contact, so the same
 * primary-move branch covers all three input kinds without checking pointerType.
 */
function onPointerMove(event: PointerEvent): void {
  if (framing.value) {
    emit('frame-drag', cellUnder(event))
    return
  }
  if (dragging.value) {
    emit('pan', event.clientX - lastPoint.x, event.clientY - lastPoint.y)
    lastPoint = { x: event.clientX, y: event.clientY }
    return
  }
  // The Hand tool never hovers: it changes no bead, so there is nothing to preview. Nor does setting the Frame.
  if (props.moving || props.settingFrame) {
    overBead.value = false
    return
  }

  const bead = beadUnder(event)
  overBead.value = bead !== undefined
  if (isSameBead(bead, lastBead)) {
    return
  }
  lastBead = bead
  if (!bead) {
    return
  }

  if (hoversFor(event)) emit('cell-hover', bead.row, bead.column)
  if (event.buttons & 1) {
    emit('cell-primary-move', bead.row, bead.column)
  }
  if (event.buttons & 2) {
    emit('cell-secondary-move', bead.row, bead.column)
  }
}

function onPointerEnd(): void {
  dragging.value = false
  if (framing.value) {
    framing.value = false
    emit('frame-release')
  }
}

function onPointerLeave(): void {
  lastBead = undefined
  overBead.value = false
  emit('hover-end')
}

/** The wheel's distance in px whichever unit the device reports it in. */
function wheelPx(delta: number, mode: number): number {
  return mode === 1 ? delta * 16 : mode === 2 ? delta * size.value.height : delta
}

/** Ctrl/⌘ + wheel zooms (a trackpad's pinch arrives the same way); the wheel on its own moves the canvas, Shift turning a vertical wheel sideways. */
function onWheel(event: WheelEvent): void {
  event.preventDefault()
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
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measure)
})

defineExpose({ measure })
</script>

<template>
  <div
    ref="rootEl"
    class="pattern-surface"
    data-testid="pattern-surface"
    data-tour="board"
    :data-technique="pattern.technique"
    :data-rotation="pattern.rotation"
    :data-zoom="zoom"
    :data-scroll-x="scroll.x"
    :data-scroll-y="scroll.y"
    :class="{
      'pattern-surface--over-bead': overBead && !moving,
      'pattern-surface--moving': moving,
      'pattern-surface--setting-frame': settingFrame && !moving,
      'pattern-surface--dragging': dragging,
    }"
    tabindex="0"
    role="img"
    :aria-label="label"
    @focus="onFocus"
    @blur="onBlur"
    @keydown="emit('cursor-key', $event)"
    @pointerdown.capture="onPress"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @pointerleave="onPointerLeave"
    @wheel="onWheel"
    @contextmenu.prevent
  >
    <canvas ref="baseEl" class="pattern-surface__canvas" data-testid="pattern-surface-cells" />
    <canvas ref="overlayEl" class="pattern-surface__canvas" data-testid="pattern-surface-overlay" />
  </div>
</template>

<style scoped>
.pattern-surface:focus {
  /* The bead cursor on the overlay is the focus indicator (BeadCursor card). */
  outline: none;
}

.pattern-surface {
  position: absolute;
  inset: 0;
  overflow: hidden;
  /*
   * Without this (ticket 60), a touch/pen drag across the canvas is fair game for the browser to treat as a scroll/pan
   * gesture instead of delivering it to the pointermove handler.
   */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

/* A crosshair over the canvas's beads (BeadHover card). */
.pattern-surface--over-bead {
  cursor: crosshair;
}

/* The Hand tool and Space + drag (CanvasHint card): an open hand, closed while the canvas is being moved. */
.pattern-surface--moving {
  cursor: grab;
}

/* Set Frame: a crosshair, since a drag marks out beads (Frame card). */
.pattern-surface--setting-frame {
  cursor: crosshair;
}

.pattern-surface--dragging {
  cursor: grabbing;
}

.pattern-surface__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
</style>
