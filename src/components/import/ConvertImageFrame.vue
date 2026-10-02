<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch, watchPostEffect } from 'vue'
import { beadPitchMm, type Bead } from '../../domain/beads'
import {
  CELL_SIZE_PX,
  GRID_BORDER_PX,
  CANVAS_MAX_PX,
  computeFitZoom,
  type GridDimensions,
  type Technique,
} from '../../domain/grid'
import { approximatePreviewColors, exactPreviewColors } from '../../domain/framingPreview'
import {
  MAX_IMAGE_COLORS,
  MIN_IMAGE_COLORS,
  convertPackedFrame,
  sampleLatticePacked,
  type ConvertedImage,
  type PixelData,
} from '../../domain/imageConversion'
import { frameSizeMm, framingView, previewLattice, type PanFraction } from '../../domain/imageFraming'
import type { Cell, Grid } from '../../domain/pattern'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import { LIGHT_THEME, type BeadDrawer } from '../../rendering/beadLook'
import { renderDraft, usesDraftLook } from '../../rendering/draftRenderer'
import { patternExtentPx, renderPattern, rowTopPx } from '../../rendering/patternRenderer'

/**
 * The framing step of Convert image (ticket 58, ADR 0010), which takes the canvas panel over: the picture rendered as
 * beads with the Pattern's own frame laid over it, and the picture moved underneath by zooming and dragging until the
 * right part is inside.
 *
 * The preview is the conversion, not a picture of it. Every bead on screen comes out of one sampling pass (see
 * sampleLatticePacked), and the Pattern this creates is the block of that pass which falls inside the frame — so "what
 * is inside the frame is exactly the Pattern that will be created" is true by construction rather than by two pieces of
 * code agreeing.
 *
 * The beads are drawn by the Pattern renderer onto one canvas (ticket 104, ADR 0018), the same way the editor draws a
 * Pattern, so the preview and the Pattern that follows it look like each other in every Technique. The frame outline
 * and the dimming around it stay ordinary elements over the canvas.
 *
 * A block too big to draw bead by bead on every move of a drag is drawn in a coarser look while the picture moves (ticket
 * 122, see draftRenderer), so that the drag holds its frame rate; the beads are back when it is at rest.
 *
 * Reducing a picture to the chosen number of colors costs more than a frame of a drag has to spend, so while the
 * picture is being dragged the beads take the colors the conversion had when the drag began (each to the nearest of
 * them), and it is worked out exactly again when the drag ends or the pointer pauses. At rest, and so for Create, it is
 * exactly the conversion, as ever.
 */
const props = defineProps<{
  image: PixelData
  /** The New Pattern form's live values: these size the frame, and the frame follows them as they are edited. */
  technique: Technique
  bead: Bead
  dimensions: GridDimensions
  /** A multiple of the scale at which the picture just covers the frame (see domain/imageFraming). */
  zoom: number
  pan: PanFraction
  maxColors: number
  /** The canvas panel's measured width, so the preview is fitted to the room actually available. */
  availableWidth: number
  /** How one bead is drawn; the renderer's own flat bead unless given. */
  drawBead?: BeadDrawer
  /**
   * Where the conversion controls go (ConvertImage card): the canvas box's bottom, in the Progress bar's place. Left
   * out, they stay under the preview.
   */
  controlsTo?: HTMLElement
}>()

const emit = defineEmits<{
  pan: [pan: PanFraction]
  'set-max-colors': [maxColors: number]
  create: [converted: ConvertedImage]
  cancel: []
}>()

const { t } = useI18n()

/** How long the pointer has to stay still, mid-drag, before the colors are worked out exactly. */
const PAUSE_MS = 150

/** The Pattern's own real-world footprint — what the picture is framed against (ADR 0010). */
const frame = computed(() => frameSizeMm(props.technique, props.dimensions, props.bead))

const dragging = ref(false)

/**
 * The pan the exact conversion is for. It is the live pan whenever the picture is at rest, and stays where it was while
 * a drag is going on (until the drag ends or pauses): everything worked out from it below is then not recomputed on each
 * move, and its Image colors are the ones held for the approximate colors.
 */
const restPan = shallowRef<PanFraction>(props.pan)
let pauseTimer: ReturnType<typeof setTimeout> | undefined

function settle(): void {
  clearTimeout(pauseTimer)
  pauseTimer = undefined
  restPan.value = props.pan
}

watch(
  () => props.pan,
  () => {
    if (!dragging.value) {
      settle()
      return
    }
    clearTimeout(pauseTimer)
    pauseTimer = setTimeout(settle, PAUSE_MS)
  },
  { flush: 'sync' },
)

/** Where the picture sits under the frame at rest, and everything the exact conversion follows from it. */
const restView = computed(() => framingView(props.image, frame.value, props.zoom, restPan.value))

/** The block of beads drawn: the frame, plus as much of the picture around it as the budget allows. */
function latticeFor(view: ReturnType<typeof framingView>) {
  return previewLattice({
    view,
    frame: frame.value,
    dimensions: props.dimensions,
    bead: props.bead,
    technique: props.technique,
  })
}

function sampledFor(view: ReturnType<typeof framingView>, lattice: ReturnType<typeof latticeFor>) {
  return sampleLatticePacked({
    image: props.image,
    view,
    technique: props.technique,
    bead: props.bead,
    lattice,
  })
}

const restLattice = computed(() => latticeFor(restView.value))
const restSampled = computed(() => sampledFor(restView.value, restLattice.value))

/** The Pattern this would create: the frame's block of that same pass, reduced to at most maxColors colors. */
const converted = computed(() =>
  convertPackedFrame(restSampled.value, restLattice.value, props.dimensions, props.maxColors),
)

/** Whether the picture is away from where the exact conversion was made, which is the only time the beads are approximate. */
const moving = computed(() => dragging.value && props.pan !== restPan.value)

const liveView = computed(() => (moving.value ? framingView(props.image, frame.value, props.zoom, props.pan) : restView.value))
const lattice = computed(() => (moving.value ? latticeFor(liveView.value) : restLattice.value))
const sampled = computed(() => (moving.value ? sampledFor(liveView.value, lattice.value) : restSampled.value))

/**
 * What each lattice bead shows. At rest, inside the frame it is the converted grid itself and outside it is the nearest
 * Image color, so the surround reads as part of the same bead picture rather than as unquantized pixels — it is context
 * for judging the crop, and it is dimmed (see the frame overlay below) precisely because it is not the Pattern. While
 * the picture moves, every bead is the nearest of the colors held from when the move began.
 */
const beadColors = computed(() =>
  moving.value
    ? approximatePreviewColors(sampled.value, converted.value.imageColors)
    : exactPreviewColors(sampled.value, lattice.value, props.dimensions, converted.value),
)

/** The lattice as a block of beads for the renderer: not a saved Pattern, but shaped like one, with no Row progress and upright. */
const drawnPattern = computed(() => {
  const { columns, rows } = lattice.value
  const grid: Grid = Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column): Cell => ({ color: beadColors.value[row * columns + column] ?? null })),
  )
  return {
    technique: props.technique,
    columns,
    rows,
    grid,
    rowProgress: { enabled: false, direction: 'rows' as const, currentRow: 0, currentColumn: 0 },
    rotation: 0 as const,
  }
})

/** The lattice at its natural bead size, in unscaled px. */
const latticeExtent = computed(() => patternExtentPx(props.technique, lattice.value.columns, lattice.value.rows))

/**
 * How much the whole preview is scaled down to fit the canvas panel. Only the drawing scales — the frame is still the
 * Pattern's own cells, and zooming the picture is a separate thing entirely (it moves the picture under the frame,
 * see the zoom prop).
 */
const fitScale = computed(() =>
  computeFitZoom({
    columns: lattice.value.columns,
    rows: lattice.value.rows,
    maxWidth: (props.availableWidth || CANVAS_MAX_PX) - GRID_BORDER_PX * 2,
    maxHeight: Infinity,
    technique: props.technique,
  }),
)

/** The frame drawn over the beads: the lattice cells that are the Pattern, outlined and left undimmed. */
const frameStyle = computed(() => {
  const { width, height } = patternExtentPx(props.technique, props.dimensions.columns, props.dimensions.rows)
  return {
    left: `${lattice.value.frameColumn * CELL_SIZE_PX}px`,
    top: `${rowTopPx(props.technique, lattice.value.frameRow)}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
})

/** The scaled preview has no layout size of its own (a transform doesn't reflow), so the box states it. */
const displayedSize = computed(() => ({
  width: latticeExtent.value.width * fitScale.value,
  height: latticeExtent.value.height * fitScale.value,
}))
const boxStyle = computed(() => ({
  width: `${displayedSize.value.width}px`,
  height: `${displayedSize.value.height}px`,
}))

const canvasEl = ref<HTMLCanvasElement>()

/** Draws the beads whenever what is drawn or its scale changes, once the canvas has its new size. */
watchPostEffect(() => {
  const canvas = canvasEl.value
  const { width, height } = displayedSize.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) {
    return
  }

  // A high-density screen gets a bigger bitmap for the same CSS size, so the beads stay crisp.
  const pixelRatio = window.devicePixelRatio || 1
  const bitmapWidth = Math.max(1, Math.round(width * pixelRatio))
  const bitmapHeight = Math.max(1, Math.round(height * pixelRatio))
  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth
    canvas.height = bitmapHeight
  }

  // A block too big to draw bead by bead on every move of a drag is drawn coarsely for as long as the picture moves (see
  // draftRenderer); the beads themselves, and the Pattern they are, come back when it is at rest.
  if (moving.value && usesDraftLook(props.technique, lattice.value.columns * lattice.value.rows)) {
    renderDraft(context, {
      technique: props.technique,
      columns: lattice.value.columns,
      rows: lattice.value.rows,
      colors: beadColors.value,
      theme: LIGHT_THEME,
      bitmapWidth,
      bitmapHeight,
    })
    return
  }

  renderPattern(context, {
    pattern: drawnPattern.value,
    region: { x: 0, y: 0, width, height },
    zoom: fitScale.value,
    pixelRatio,
    // The board look in light, whatever the app's theme (ticket 150), like the Pattern the picture becomes will print.
    theme: LIGHT_THEME,
    drawBead: props.drawBead,
  })
})

/** "Colors at most" as the Stepper sets it: the parent keeps the count (useConvertImage). */
const maxColorsModel = computed({
  get: () => props.maxColors,
  set: (count: number) => emit('set-max-colors', count),
})

/** Where the picture can still move under the frame, in millimetres: zero when it covers the frame exactly. */
const panRangeMm = computed(() => ({
  x: Math.max(0, liveView.value.pictureWidthMm - frame.value.widthMm),
  y: Math.max(0, liveView.value.pictureHeightMm - frame.value.heightMm),
}))

/**
 * Millimetres of picture per screen pixel dragged. A bead is CELL_SIZE_PX wide on screen (before the fit scale) and
 * the Bead's own footprint in millimetres in that direction; down the page, a row is the Technique's row pitch on
 * screen and the Technique's row spacing in millimetres, the same ratio however the rows are packed.
 */
const mmPerScreenPx = computed(() => ({
  x: beadPitchMm(props.bead) / (CELL_SIZE_PX * fitScale.value),
  y: props.bead.heightMm / (CELL_SIZE_PX * fitScale.value),
}))

const drag = ref<{ x: number; y: number; pan: PanFraction } | null>(null)

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Dragging moves the picture, so dragging right shows more of the picture's left-hand side — which is a *smaller* pan
 * fraction (0 is the picture's own left edge against the frame's). An axis the picture can't move along stays put
 * rather than dividing by a zero range.
 */
function onDragMove(event: MouseEvent): void {
  const started = drag.value
  if (!started) {
    return
  }

  const movedXMm = (event.clientX - started.x) * mmPerScreenPx.value.x
  const movedYMm = (event.clientY - started.y) * mmPerScreenPx.value.y
  const range = panRangeMm.value

  emit('pan', {
    x: range.x === 0 ? started.pan.x : clampFraction(started.pan.x - movedXMm / range.x),
    y: range.y === 0 ? started.pan.y : clampFraction(started.pan.y - movedYMm / range.y),
  })
}

function endDrag(): void {
  drag.value = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', endDrag)
  if (dragging.value) {
    // Back at rest: the exact colors, for whatever the pan is now.
    dragging.value = false
    settle()
  }
}

/** The button can be released anywhere, so the drag is followed on the window rather than on the preview itself. */
function onDragStart(event: MouseEvent): void {
  event.preventDefault()
  drag.value = { x: event.clientX, y: event.clientY, pan: { ...props.pan } }
  dragging.value = true
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', endDrag)
}

onBeforeUnmount(() => {
  endDrag()
  clearTimeout(pauseTimer)
})
</script>

<template>
  <!--
    The framing step (ticket 150; ConvertImage card) inside the canvas box: the canvas strip names the step, the picture
    fills the drawing area as beads with the frame at the Pattern's size, everything outside the frame dimmed, and the
    hint on the picture, bottom-left. The controls take the Progress bar's place.
  -->
  <section class="convert-image-frame" :aria-label="t.convertImage.heading" data-testid="convert-image-frame">
    <div class="convert-image-frame__box" data-testid="convert-image-box" :style="boxStyle" @mousedown.left="onDragStart">
      <canvas
        ref="canvasEl"
        class="convert-image-frame__canvas"
        data-testid="convert-image-canvas"
        :data-technique="technique"
        :data-columns="lattice.columns"
        :data-rows="lattice.rows"
        :style="boxStyle"
      />

      <div
        class="convert-image-frame__lattice"
        data-testid="convert-image-lattice"
        :class="`convert-image-frame__lattice--${technique}`"
        :style="{ transform: `scale(${fitScale})`, width: `${latticeExtent.width}px`, height: `${latticeExtent.height}px` }"
      >
        <!--
          The frame itself. Its huge outward box-shadow is what dims everything around it in one element, so the part
          of the picture that isn't becoming the Pattern steps back without a second layer to keep in position.
        -->
        <div class="convert-image-frame__frame" data-testid="convert-image-frame-outline" :style="frameStyle" />
      </div>

      <p class="convert-image-frame__hint">{{ t.convertImage.panHint }}</p>
    </div>

    <Teleport :to="controlsTo ?? 'body'" :disabled="!controlsTo">
      <div class="convert-image-frame__controls" data-testid="convert-image-controls">
        <span class="convert-image-frame__setting" data-testid="convert-image-colors">
          <span class="convert-image-frame__label" data-testid="convert-image-max-colors">
            {{ t.convertImage.maxColorsLabel }}
            <AppStepper
              v-model="maxColorsModel"
              :min="MIN_IMAGE_COLORS"
              :max="MAX_IMAGE_COLORS"
              :decrease-label="t.convertImage.decreaseColorsButton"
              :increase-label="t.convertImage.increaseColorsButton"
              decrease-testid="convert-image-colors-decrease"
              increase-testid="convert-image-colors-increase"
            />
          </span>
        </span>
        <span class="convert-image-frame__setting">
          <span class="convert-image-frame__swatches" aria-hidden="true">
            <span
              v-for="color in converted.imageColors"
              :key="color"
              class="convert-image-frame__swatch"
              :style="{ backgroundColor: color }"
            />
          </span>
          <span class="convert-image-frame__label" data-testid="convert-image-found-colors">
            {{ t.convertImage.foundColorsLabel }}: {{ converted.imageColors.length }}
          </span>
        </span>

        <span class="convert-image-frame__actions">
          <AppButton variant="box" data-testid="convert-image-cancel" @click="emit('cancel')">
            {{ t.convertImage.cancelButton }}
          </AppButton>
          <AppButton variant="primary" icon="plus" data-testid="convert-image-create" @click="emit('create', converted)">
            {{ t.convertImage.createButton }}
          </AppButton>
        </span>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.convert-image-frame {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-12);
}

/*
 * The preview's own box, sized to the scaled lattice (a transform leaves no layout size behind); the canvas fills it
 * with the light board. It clips the frame outline's dimming shadow, which reaches far past the beads on purpose.
 */
.convert-image-frame__box {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
  cursor: grab;
}

.convert-image-frame__box:active {
  cursor: grabbing;
}

/* The beads are drawn on the canvas, which fills the box; the lattice over it only carries the frame outline, at the same scale. */
.convert-image-frame__canvas {
  display: block;
}

.convert-image-frame__lattice {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  pointer-events: none;
}

.convert-image-frame__frame {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  outline: 2px solid var(--accent);
  /* One element dims everything outside the frame: an outward shadow big enough to cover the rest of the box. */
  box-shadow: 0 0 0 9999px var(--framing-dim);
}

/* The hint sits on the picture, bottom-left, on its own dark label so it reads over any picture. */
.convert-image-frame__hint {
  position: absolute;
  bottom: var(--space-8);
  left: var(--space-8);
  z-index: 2;
  margin: 0;
  padding: var(--space-4) var(--space-8);
  font: var(--type-small);
  color: var(--canvas);
  pointer-events: none;
  background: var(--ink);
  border-radius: var(--radius-sm);
}

/* In the Progress bar's place: the same height and rule, the settings on the left and Cancel and Create on the right. */
.convert-image-frame__controls {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-8) var(--space-20);
  box-sizing: border-box;
  min-height: var(--progress-height);
  padding: var(--space-8) var(--space-12) var(--space-8) var(--space-16);
  border-top: 1px solid var(--box-line);
}

.convert-image-frame__setting {
  display: inline-flex;
  align-items: center;
  gap: var(--space-8);
}

.convert-image-frame__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-8);
  font: var(--type-label);
  color: var(--box-muted);
  text-transform: lowercase;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.convert-image-frame__swatches {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  max-width: calc(7 * (var(--swatch-dot) + var(--space-2)));
}

.convert-image-frame__swatch {
  width: var(--swatch-dot);
  height: var(--swatch-dot);
  border-radius: var(--swatch-dot-radius);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.convert-image-frame__actions {
  display: inline-flex;
  gap: var(--space-8);
  margin-left: auto;
}
</style>
