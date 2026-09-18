<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Bead } from '../domain/beads'
import {
  CELL_SIZE_PX,
  GRID_BORDER_PX,
  CANVAS_MAX_PX,
  computeFitZoom,
  gridHeightPx,
  gridWidthPx,
  rowHeightPx,
  rowOffsetPx,
  type GridDimensions,
  type Technique,
} from '../domain/grid'
import {
  MAX_IMAGE_COLORS,
  MIN_IMAGE_COLORS,
  convertSampledFrame,
  previewColorOutsideFrame,
  sampleLattice,
  type ConvertedImage,
  type PixelData,
} from '../domain/imageConversion'
import { frameSizeMm, framingView, previewLattice, type PanFraction } from '../domain/imageFraming'
import { useI18n } from '../i18n/useI18n'

/**
 * The framing step of Convert image (ticket 58, ADR 0010), which takes the canvas panel over: the picture rendered as
 * beads with the Pattern's own frame laid over it, and the picture moved underneath by zooming and dragging until the
 * right part is inside.
 *
 * The preview is the conversion, not a picture of it. Every bead on screen comes out of one sampling pass (see
 * sampleLattice), and the Pattern this creates is the block of that pass which falls inside the frame — so "what is
 * inside the frame is exactly the Pattern that will be created" is true by construction rather than by two pieces of
 * code agreeing.
 *
 * Rendered as positioned DOM elements, one per bead, the same way PatternGrid draws a Pattern — including the same
 * per-technique stagger and row packing, so the preview and the Pattern that follows it look like each other.
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
}>()

const emit = defineEmits<{
  pan: [pan: PanFraction]
  'set-max-colors': [maxColors: number]
  create: [converted: ConvertedImage]
  cancel: []
}>()

const { t } = useI18n()

/** The Pattern's own real-world footprint — what the picture is framed against (ADR 0010). */
const frame = computed(() => frameSizeMm(props.technique, props.dimensions, props.bead))

/** Where the picture sits under the frame right now, in the frame's millimetres. */
const view = computed(() => framingView(props.image, frame.value, props.zoom, props.pan))

/** The block of beads drawn: the frame, plus as much of the picture around it as the budget allows. */
const lattice = computed(() =>
  previewLattice({
    view: view.value,
    frame: frame.value,
    dimensions: props.dimensions,
    bead: props.bead,
    technique: props.technique,
  }),
)

/** One sampling pass over the whole lattice — the frame's own cells included. */
const sampled = computed(() =>
  sampleLattice({
    image: props.image,
    view: view.value,
    technique: props.technique,
    bead: props.bead,
    lattice: lattice.value,
  }),
)

/** The Pattern this would create: the frame's block of that same pass, reduced to at most maxColors colors. */
const converted = computed(() =>
  convertSampledFrame(sampled.value, lattice.value, props.dimensions, props.maxColors),
)

/**
 * What each lattice bead shows. Inside the frame it is the converted grid itself. Outside it is the nearest Image
 * color, so the surround reads as part of the same bead picture rather than as unquantized pixels — it is context for
 * judging the crop, and it is dimmed (see the frame overlay below) precisely because it is not the Pattern.
 */
const beadColors = computed(() => {
  const { frameRow, frameColumn, rows, columns } = lattice.value
  const { grid, imageColors } = converted.value

  return Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column) => {
      const inFrame = grid[row - frameRow]?.[column - frameColumn]
      return inFrame
        ? inFrame.color ?? undefined
        : previewColorOutsideFrame(imageColors, sampled.value[row]?.[column])
    }),
  )
})

/** The lattice at its natural bead size, in unscaled px. */
const latticeWidthPx = computed(() => gridWidthPx(props.technique, lattice.value.columns))
const latticeHeightPx = computed(() => gridHeightPx(props.technique, lattice.value.rows))

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
const frameStyle = computed(() => ({
  left: `${lattice.value.frameColumn * CELL_SIZE_PX}px`,
  top: `${lattice.value.frameRow * rowHeightPx(props.technique)}px`,
  width: `${gridWidthPx(props.technique, props.dimensions.columns)}px`,
  height: `${gridHeightPx(props.technique, props.dimensions.rows)}px`,
}))

/** The scaled preview has no layout size of its own (a transform doesn't reflow), so the box states it. */
const boxStyle = computed(() => ({
  width: `${latticeWidthPx.value * fitScale.value}px`,
  height: `${latticeHeightPx.value * fitScale.value}px`,
}))

function rowOverlapPx(rowIndex: number): number {
  return rowIndex === 0 ? 0 : rowHeightPx(props.technique) - CELL_SIZE_PX
}

/** Where the picture can still move under the frame, in millimetres: zero when it covers the frame exactly. */
const panRangeMm = computed(() => ({
  x: Math.max(0, view.value.pictureWidthMm - frame.value.widthMm),
  y: Math.max(0, view.value.pictureHeightMm - frame.value.heightMm),
}))

/**
 * Millimetres of picture per screen pixel dragged. A bead is CELL_SIZE_PX wide on screen (before the fit scale) and
 * the Bead's own footprint in millimetres, in both directions — peyote's 0.75 row packing applies equally to the
 * screen row and the millimetre row, so it cancels here.
 */
const mmPerScreenPx = computed(() => ({
  x: props.bead.widthMm / (CELL_SIZE_PX * fitScale.value),
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
}

/** The button can be released anywhere, so the drag is followed on the window rather than on the preview itself. */
function onDragStart(event: MouseEvent): void {
  event.preventDefault()
  drag.value = { x: event.clientX, y: event.clientY, pan: { ...props.pan } }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', endDrag)
}

onBeforeUnmount(endDrag)
</script>

<template>
  <section class="convert-image-frame" data-testid="convert-image-frame">
    <h2 class="convert-image-frame__heading">{{ t.convertImage.heading }}</h2>

    <div class="convert-image-frame__box" :style="boxStyle" @mousedown.left="onDragStart">
      <div
        class="convert-image-frame__lattice"
        data-testid="convert-image-lattice"
        :class="`convert-image-frame__lattice--${technique}`"
        :style="{ transform: `scale(${fitScale})`, width: `${latticeWidthPx}px`, height: `${latticeHeightPx}px` }"
      >
        <div
          v-for="(row, rowIndex) in beadColors"
          :key="rowIndex"
          class="convert-image-frame__row"
          data-testid="convert-image-row"
          :style="{
            marginLeft: `${rowOffsetPx(technique, rowIndex)}px`,
            marginTop: `${rowOverlapPx(rowIndex)}px`,
          }"
        >
          <div
            v-for="(color, columnIndex) in row"
            :key="columnIndex"
            class="convert-image-frame__bead"
            data-testid="convert-image-bead"
            :style="{ width: `${CELL_SIZE_PX}px`, height: `${CELL_SIZE_PX}px`, backgroundColor: color }"
          />
        </div>

        <!--
          The frame itself. Its huge outward box-shadow is what dims everything around it in one element, so the part
          of the picture that isn't becoming the Pattern steps back without a second layer to keep in position.
        -->
        <div class="convert-image-frame__frame" data-testid="convert-image-frame-outline" :style="frameStyle" />
      </div>
    </div>

    <p class="convert-image-frame__hint">{{ t.convertImage.panHint }}</p>

    <div class="convert-image-frame__controls">
      <p class="convert-image-frame__colors" data-testid="convert-image-colors">
        <button
          type="button"
          class="icon-button"
          data-testid="convert-image-colors-decrease"
          :title="t.convertImage.decreaseColorsButton"
          :aria-label="t.convertImage.decreaseColorsButton"
          :disabled="maxColors <= MIN_IMAGE_COLORS"
          @click="emit('set-max-colors', maxColors - 1)"
        >
          −
        </button>
        <span class="convert-image-frame__colors-label" data-testid="convert-image-max-colors">
          {{ t.convertImage.maxColorsLabel }}: {{ maxColors }}
        </span>
        <button
          type="button"
          class="icon-button"
          data-testid="convert-image-colors-increase"
          :title="t.convertImage.increaseColorsButton"
          :aria-label="t.convertImage.increaseColorsButton"
          :disabled="maxColors >= MAX_IMAGE_COLORS"
          @click="emit('set-max-colors', maxColors + 1)"
        >
          +
        </button>
        <span class="convert-image-frame__colors-label" data-testid="convert-image-found-colors">
          {{ t.convertImage.foundColorsLabel }}: {{ converted.imageColors.length }}
        </span>
      </p>

      <div class="convert-image-frame__actions">
        <button type="button" data-testid="convert-image-create" @click="emit('create', converted)">
          {{ t.convertImage.createButton }}
        </button>
        <button type="button" data-testid="convert-image-cancel" @click="emit('cancel')">
          {{ t.convertImage.cancelButton }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.convert-image-frame {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.convert-image-frame__heading {
  margin: 0;
  font-size: 20px;
}

/*
 * The preview's own box, sized to the scaled lattice (a transform leaves no layout size behind), carrying the same
 * card frame the Pattern's own box does. It clips the frame outline's dimming shadow, which reaches far past the
 * beads on purpose.
 */
.convert-image-frame__box {
  position: relative;
  overflow: hidden;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
  cursor: grab;
}

.convert-image-frame__box:active {
  cursor: grabbing;
}

.convert-image-frame__lattice {
  position: relative;
  transform-origin: top left;
}

.convert-image-frame__row {
  display: flex;
}

.convert-image-frame__bead {
  box-sizing: border-box;
  border: 1px solid var(--color-paper);
  /* The same "nothing here" tint an unpainted Pattern cell carries (PatternGrid.vue), for a pixel too transparent to weave. */
  background-color: color-mix(in srgb, var(--color-ink) 25%, var(--color-paper-solid));
}

/* Peyote's interlocking beads read as diamonds, the same as in the Pattern this will create. */
.convert-image-frame__lattice--peyote .convert-image-frame__bead {
  border-radius: 30%;
}

.convert-image-frame__lattice--brick .convert-image-frame__row {
  border-top: 1px solid var(--color-ink);
}

.convert-image-frame__lattice--brick .convert-image-frame__row:first-child {
  border-top: none;
}

.convert-image-frame__frame {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  border: var(--border-width) solid var(--color-wedgewood);
  /* One element dims everything outside the frame: an outward shadow big enough to cover the rest of the box. */
  box-shadow: 0 0 0 9999px color-mix(in srgb, var(--color-paper-solid) 65%, transparent);
}

.convert-image-frame__hint {
  margin: 0;
  opacity: 0.6;
}

.convert-image-frame__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.convert-image-frame__colors,
.convert-image-frame__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.convert-image-frame__colors-label {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
