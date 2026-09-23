<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue'
import { GRID_BORDER_PX, type GridPosition, type PreviewCell } from '../domain/grid'
import type { MirrorAxisCounts } from '../domain/mirror'
import type { Selection } from '../domain/selection'
import type { Pattern } from '../domain/pattern'
import { beadAt } from '../rendering/hitTest'
import { renderOverlay } from '../rendering/overlayRenderer'
import { displayedExtentPx, renderPattern } from '../rendering/patternRenderer'
import { contains, drawingWindow, type Rect } from '../rendering/surfaceWindow'

/**
 * A Pattern drawn by the Pattern renderer instead of one DOM element per bead (ADR 0018): the Drawing surface of
 * CONTEXT.md. It is the box the DOM grid was (the outline, the paper behind the beads) with two canvases inside it, one
 * for the cells and one over it for what comes and goes with a tool or the pointer (see overlayRenderer).
 *
 * The canvases are only as big as the screen, not the Pattern: at 300% a 250 × 250 Pattern is 15,000 px across, which no
 * canvas can be (iPad Safari's limit is about 16 megapixels) and no one needs to look at at once. So they hold a window
 * of the displayed Pattern, the part on screen plus a margin, and are drawn again when the screen moves out of it —
 * on scroll, on zoom — leaving the cost to follow what is visible rather than how big the Pattern is.
 *
 * It sits where the DOM grid did, inside the canvas panel's own scroll containers and zoom box (PatternCanvas.vue), but
 * not inside the CSS transform that zooms and turns the rulers: a canvas scaled by a transform is a bitmap stretched, and
 * beads must stay crisp at every zoom, so the renderer applies the zoom and the rotation itself.
 */
const props = defineProps<{
  pattern: Pattern
  /** How much the Pattern is enlarged by; 1 is a bead 20 px across. */
  zoom: number
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
}>()

const emit = defineEmits<{
  'cell-primary-down': [row: number, column: number]
  'cell-primary-move': [row: number, column: number]
  'cell-secondary-down': [row: number, column: number]
  'cell-secondary-move': [row: number, column: number]
  'cell-hover': [row: number, column: number]
  'hover-end': []
}>()

/** How much beyond the screen the canvases reach, so that a little scrolling does not need a redraw. */
const MARGIN_PX = 160

/**
 * A Pattern whose whole bitmap is no bigger than this many device pixels is held whole (ticket 122): its window is all
 * of it, so scrolling never leaves what is drawn and costs nothing. Without this, a Pattern only a little bigger than
 * the screen (250 × 250 at its fit zoom is 1500 px each way) runs out of margin on the side its window is cut to the
 * Pattern's edge and is drawn again every few wheel clicks. Well inside the roughly 16 megapixels of iPad Safari's
 * canvas limit, since the cells and the overlay each have one.
 */
const WHOLE_PATTERN_MAX_DEVICE_PX = 10_000_000

const displayed = computed(() =>
  displayedExtentPx(props.pattern.technique, props.pattern.columns, props.pattern.rows, props.zoom, props.pattern.rotated),
)

/** The outline is 3 px in the Pattern's own px, so it is 3 px × the zoom on screen: a fraction at most zooms. */
const border = computed(() => GRID_BORDER_PX * props.zoom)

/** Where the beads start inside the clip, which begins on a whole pixel: the part of the border past it. */
const shift = computed(() => ({ x: border.value - Math.floor(border.value), y: border.value - Math.floor(border.value) }))

const rootStyle = computed(() => ({
  width: `${displayed.value.width + border.value * 2}px`,
  height: `${displayed.value.height + border.value * 2}px`,
}))

/**
 * The outline and the paper. Drawn under the same kind of transform the DOM grid was, because a border of 0.75 px is
 * laid out as 1 px but painted as 0.75 px when scaled, and this must look like the box it replaces at every zoom.
 */
const frameStyle = computed(() => ({
  width: `${displayed.value.width / props.zoom}px`,
  height: `${displayed.value.height / props.zoom}px`,
  transform: `scale(${props.zoom})`,
}))

/** Holds the canvases and cuts them to the outline's inner corners. Starts on a whole pixel so the canvases can. */
const clipStyle = computed(() => ({
  left: `${Math.floor(border.value)}px`,
  top: `${Math.floor(border.value)}px`,
  width: `${displayed.value.width + shift.value.x}px`,
  height: `${displayed.value.height + shift.value.y}px`,
  borderRadius: `calc((var(--radius-md) - ${GRID_BORDER_PX}px) * ${props.zoom})`,
}))

const rootEl = ref<HTMLElement>()
const baseEl = ref<HTMLCanvasElement>()
const overlayEl = ref<HTMLCanvasElement>()

/** The window of the displayed Pattern the canvases hold now (see drawingWindow), or none until the screen has been looked at. */
const held = shallowRef<Rect>()

const canvasStyle = computed(() => {
  const window = held.value
  if (!window) {
    return { display: 'none' }
  }
  return {
    left: `${window.x}px`,
    top: `${window.y}px`,
    width: `${canvasSize.value.width}px`,
    height: `${canvasSize.value.height}px`,
  }
})

/** The canvases are a pixel bigger than the window, to reach the fraction of a pixel the beads start part-way into. */
const canvasSize = computed(() => {
  const window = held.value
  const clipWidth = Math.ceil(displayed.value.width + shift.value.x)
  const clipHeight = Math.ceil(displayed.value.height + shift.value.y)
  return window
    ? { width: Math.min(window.width + 1, clipWidth - window.x), height: Math.min(window.height + 1, clipHeight - window.y) }
    : { width: 0, height: 0 }
})

/**
 * What is on screen of the displayed Pattern, in its own px from its first bead: the Pattern's box cut by every
 * ancestor that clips it (the canvas panel's horizontal scroll, the box's own rounded clip) and by the window.
 */
function visibleRect(): Rect | undefined {
  const root = rootEl.value
  if (!root) {
    return undefined
  }

  const box = root.getBoundingClientRect()
  const originX = box.left + border.value
  const originY = box.top + border.value
  let left = originX
  let top = originY
  let right = originX + displayed.value.width
  let bottom = originY + displayed.value.height

  for (let ancestor = root.parentElement; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor)
    const clipsX = style.overflowX !== 'visible'
    const clipsY = style.overflowY !== 'visible'
    if (clipsX || clipsY) {
      const clip = ancestor.getBoundingClientRect()
      if (clipsX) {
        left = Math.max(left, clip.left)
        right = Math.min(right, clip.right)
      }
      if (clipsY) {
        top = Math.max(top, clip.top)
        bottom = Math.min(bottom, clip.bottom)
      }
    }
  }

  left = Math.max(left, 0)
  top = Math.max(top, 0)
  right = Math.min(right, window.innerWidth)
  bottom = Math.min(bottom, window.innerHeight)

  return right > left && bottom > top ? { x: left - originX, y: top - originY, width: right - left, height: bottom - top } : undefined
}

/** Looks at what is on screen and, if it has moved out of what the canvases hold, moves them to hold it. */
function update(): void {
  const visible = visibleRect()
  if (!visible || (held.value && contains(held.value, visible))) {
    return
  }
  const pixelRatio = globalThis.devicePixelRatio || 1
  const wholeArea = displayed.value.width * displayed.value.height * pixelRatio * pixelRatio
  held.value = drawingWindow(visible, displayed.value, wholeArea <= WHOLE_PATTERN_MAX_DEVICE_PX ? Infinity : MARGIN_PX)
}

/** Drawing is at most once a frame however many scroll events arrive. */
let frame = 0
function schedule(): void {
  if (frame === 0) {
    frame = requestAnimationFrame(() => {
      frame = 0
      update()
    })
  }
}

/** What the cells were last drawn from, to draw only what an edit changed. */
let drawn: { pattern: Pattern; zoom: number; held: Rect; pixelRatio: number } | undefined

/** Whether two Patterns are laid out and dimmed alike, so that what differs between them is only which color each bead holds. */
function sameLayout(a: Pattern, b: Pattern): boolean {
  const progress = (pattern: Pattern) => pattern.rowProgress
  return (
    a.technique === b.technique &&
    a.columns === b.columns &&
    a.rows === b.rows &&
    a.rotated === b.rotated &&
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
 * neighbours are drawn with it anyway. Empty when nothing on screen changed; undefined when so much did (an Undo, a
 * Fill, a Mirror current) that drawing it all again is the cheaper way.
 */
function changedBands(before: Pattern, after: Pattern): { first: number; last: number }[] | undefined {
  const changed: number[] = []
  for (let row = 0; row < after.rows; row += 1) {
    const was = before.grid[row]
    const now = after.grid[row]
    if (was === now || !was || !now) {
      continue
    }
    for (let column = 0; column < after.columns; column += 1) {
      if (was[column]?.color !== now[column]?.color) {
        changed.push(row)
        break
      }
    }
  }
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

/** Sizes a canvas to the window and the screen's pixel density, leaving it alone (and its drawing with it) when it already is. Whether it had to change. */
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

/** The part of the displayed Pattern the canvases show, in the displayed Pattern's px: the window, from where the beads start part-way into a pixel. */
function currentRegion(window: Rect): Rect {
  const { width, height } = canvasSize.value
  return { x: window.x - shift.value.x, y: window.y - shift.value.y, width, height }
}

/** Draws the cells: all of them, or, when an edit changed only some rows of what is already drawn, just those. */
function drawCells(): void {
  const window = held.value
  const canvas = baseEl.value
  if (!window || !canvas) {
    return
  }

  const pixelRatio = globalThis.devicePixelRatio || 1
  const region = currentRegion(window)
  const pattern = toRaw(props.pattern)
  const resized = sizeCanvas(canvas, region.width, region.height, pixelRatio)
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  const before = drawn
  drawn = { pattern, zoom: props.zoom, held: window, pixelRatio }
  const bands =
    !resized && before && before.held === window && before.zoom === props.zoom && before.pixelRatio === pixelRatio && sameLayout(before.pattern, pattern)
      ? changedBands(before.pattern, pattern)
      : undefined

  if (bands === undefined) {
    renderPattern(context, { pattern, region, zoom: props.zoom, pixelRatio })
    return
  }
  for (const rows of bands) {
    renderPattern(context, { pattern, region, zoom: props.zoom, pixelRatio, rows })
  }
}

/** Draws the overlay: everything over the cells that comes and goes with a tool or the pointer. */
function drawOverlay(): void {
  const window = held.value
  const canvas = overlayEl.value
  if (!window || !canvas) {
    return
  }

  const pixelRatio = globalThis.devicePixelRatio || 1
  const region = currentRegion(window)
  sizeCanvas(canvas, region.width, region.height, pixelRatio)
  const context = canvas.getContext('2d')
  if (context) {
    renderOverlay(context, {
      pattern: toRaw(props.pattern),
      region,
      zoom: props.zoom,
      pixelRatio,
      preview: props.previewCells && props.previewCells.length > 0 ? { cells: props.previewCells, color: props.previewColor ?? null } : undefined,
      selection: props.selection,
      mirrorAxisCounts: props.mirrorAxisCounts,
      dimmedCells: props.dimmedCells,
    })
  }
}

/**
 * A different size (a zoom, a Resize, a Rotate) starts from what is on screen again, once the box has its new size. Its
 * numbers are watched, not the object they come in: an edit that changes no size must not send the canvases away.
 */
watch(
  () => `${displayed.value.width}x${displayed.value.height}`,
  () => {
    held.value = undefined
    void nextTick(update)
  },
  { flush: 'post' },
)

// The Pattern is replaced whole by every edit, so its identity is all that needs watching: a deep watch would make the
// draw depend on every bead's property.
watch([held, () => props.pattern, () => props.zoom], drawCells, { flush: 'post' })
watch(
  [
    held,
    () => props.pattern,
    () => props.zoom,
    () => props.previewCells,
    () => props.previewColor,
    () => props.selection,
    () => props.mirrorAxisCounts,
    () => props.dimmedCells,
  ],
  drawOverlay,
  { flush: 'post' },
)

/**
 * Pointer events (ticket 60), not mouse events, so a paint or erase stroke works the same by mouse, touch and pen. The
 * surface is one element, so which bead a pointer is on is worked out from where it is (see beadAt) instead of being
 * told by the bead's own element; and, as an element's pointerenter did, only a change of bead is news. A touch or pen
 * contact keeps its implicit capture on the surface, so the moves of a stroke go on arriving here.
 */
const overBead = ref(false)
let lastBead: GridPosition | undefined

function beadUnder(event: PointerEvent): GridPosition | undefined {
  const root = rootEl.value
  if (!root) {
    return undefined
  }
  const box = root.getBoundingClientRect()
  return beadAt(toRaw(props.pattern), { x: event.clientX - box.left - border.value, y: event.clientY - box.top - border.value }, props.zoom)
}

function isSameBead(a: GridPosition | undefined, b: GridPosition | undefined): boolean {
  return a?.row === b?.row && a?.column === b?.column
}

function onPointerDown(event: PointerEvent): void {
  const bead = beadUnder(event)
  overBead.value = bead !== undefined
  if (!bead) {
    lastBead = undefined
    return
  }

  // A touch has not been over the bead before it lands on it: the hover comes first, as the bead's pointerenter did.
  if (!isSameBead(bead, lastBead)) {
    lastBead = bead
    emit('cell-hover', bead.row, bead.column)
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
  const bead = beadUnder(event)
  overBead.value = bead !== undefined
  if (isSameBead(bead, lastBead)) {
    return
  }
  lastBead = bead
  if (!bead) {
    return
  }

  emit('cell-hover', bead.row, bead.column)
  if (event.buttons & 1) {
    emit('cell-primary-move', bead.row, bead.column)
  }
  if (event.buttons & 2) {
    emit('cell-secondary-move', bead.row, bead.column)
  }
}

function onPointerLeave(): void {
  lastBead = undefined
  overBead.value = false
  emit('hover-end')
}

onMounted(() => {
  update()
  window.addEventListener('scroll', schedule, { capture: true, passive: true })
  window.addEventListener('resize', schedule, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', schedule, { capture: true })
  window.removeEventListener('resize', schedule)
  cancelAnimationFrame(frame)
})

defineExpose({ update })
</script>

<template>
  <div
    ref="rootEl"
    class="pattern-surface"
    data-testid="pattern-surface"
    :data-technique="pattern.technique"
    :data-columns="pattern.columns"
    :data-rows="pattern.rows"
    :data-rotated="pattern.rotated"
    :data-zoom="zoom"
    :style="[rootStyle, { cursor: overBead ? 'pointer' : undefined }]"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @contextmenu.prevent
  >
    <div class="pattern-surface__frame" :style="frameStyle" />
    <div class="pattern-surface__clip" :style="clipStyle">
      <canvas
        ref="baseEl"
        class="pattern-surface__canvas"
        data-testid="pattern-surface-cells"
        :data-window="held ? `${held.x},${held.y},${held.width},${held.height}` : undefined"
        :style="canvasStyle"
      />
      <canvas
        ref="overlayEl"
        class="pattern-surface__canvas"
        data-testid="pattern-surface-overlay"
        :style="canvasStyle"
      />
    </div>
  </div>
</template>

<style scoped>
.pattern-surface {
  position: relative;
  /*
   * Without this (ticket 60), a touch/pen drag across the grid is fair game for the browser to treat as a scroll/pan
   * gesture instead of delivering it to the pointermove handler -- there's a horizontally scrolling ancestor
   * (.app-shell__canvas-scroll) that would otherwise compete for exactly this gesture.
   */
  touch-action: none;
}

/* The outline and the paper behind the beads, at the surface's size. */
.pattern-surface__frame {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: content-box;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
  background: var(--color-paper-solid);
  transform-origin: top left;
}

.pattern-surface__clip {
  position: absolute;
  overflow: hidden;
}

.pattern-surface__canvas {
  position: absolute;
  display: block;
}
</style>
