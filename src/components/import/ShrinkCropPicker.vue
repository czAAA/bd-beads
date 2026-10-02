<script setup lang="ts">
import { computed, onMounted, ref, toRaw, watch } from 'vue'
import { isOffsetTechnique, rotationSwapsAxes } from '../../domain/grid'
import type { Pattern } from '../../domain/pattern'
import { thumbnailPixels } from '../../rendering/patternThumbnail'
import { useI18n } from '../../i18n/useI18n'

/**
 * The shrink crop picker (ticket 173, ChangeSizeModal card): shown only once a typed size shrinks the grid, it draws
 * the current Pattern and lets the pointer choose which region a target-sized window keeps — rather than the
 * implicit top-left crop Resize falls back to when nothing is hovered (the `offset` model's own default). Dragging
 * a finger works the same way, through the same pointer events; a keyboard has no equivalent and simply keeps
 * whatever `offset` already holds.
 *
 * Offsets are in grid space (how many of the old grid's leading columns/rows a shrink drops), the same space Resize
 * itself speaks (domain/resize.ts's ResizeRequest). The picker works in view space internally -- across/down, as
 * drawn on screen -- since thumbnailPixels already turns a rotated Pattern the way it shows on screen, and swaps
 * space back to grid space at its edges (SizeControls.vue's axisOf does the same swap for the same reason).
 */
const props = defineProps<{
  pattern: Pattern
  targetColumns: number
  targetRows: number
}>()

const offset = defineModel<{ columns: number; rows: number }>('offset', { required: true })

const { t } = useI18n()

/** Pixels on the preview's longer side, comfortably inside the confirmation modal's own width. Drawn at exactly this
 *  CSS size (never stretched) so a pointer position can be turned into a cell by the same arithmetic that sized it,
 *  rather than by measuring the rendered element — jsdom lays nothing out, and PatternSurface.vue's own hit test
 *  (rendering/hitTest.ts) avoids that the same way, off zoom rather than a measured box. */
const PREVIEW_SIZE = 240

const canvasEl = ref<HTMLCanvasElement>()
let frame = 0

function draw() {
  frame = 0
  const context = canvasEl.value?.getContext('2d')
  if (!canvasEl.value || !context) return
  const image = thumbnailPixels(toRaw(props.pattern), PREVIEW_SIZE)
  canvasEl.value.width = image.width
  canvasEl.value.height = image.height
  context.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0)
}

onMounted(draw)
watch(
  () => props.pattern,
  () => {
    if (!frame) frame = requestAnimationFrame(draw)
  },
)

/** Whether the current rotation swaps which grid axis (columns/rows) is view space's across/down, the same quarter-turn rule every other axis mapping in the app follows (ticket 171: unaffected at 180°, swapped at 90°/270°). */
const swapped = computed(() => rotationSwapsAxes(props.pattern.rotation))

/** View space (as drawn): across/down swap with grid columns/rows under rotation, the same way thumbnailPixels itself does. */
const viewAcross = computed(() => (swapped.value ? props.pattern.rows : props.pattern.columns))
const viewDown = computed(() => (swapped.value ? props.pattern.columns : props.pattern.rows))
const targetAcross = computed(() => (swapped.value ? props.targetRows : props.targetColumns))
const targetDown = computed(() => (swapped.value ? props.targetColumns : props.targetRows))

/** The frame's own CSS pixel size — the same "fit the longer side" scaling thumbnailPixels uses for its canvas, worked out here too so a pointer position can be read against it without measuring the rendered element. */
const scale = computed(() => PREVIEW_SIZE / Math.max(viewAcross.value, viewDown.value))
const displayWidth = computed(() => Math.max(1, Math.round(viewAcross.value * scale.value)))
const displayHeight = computed(() => Math.max(1, Math.round(viewDown.value * scale.value)))

const maxColumnsOffset = computed(() => Math.max(0, props.pattern.columns - props.targetColumns))
const maxRowsOffset = computed(() => Math.max(0, props.pattern.rows - props.targetRows))

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, value))
}

/** Peyote and brick stitch only keep their stagger at an even row offset (resizeRefusal's own rule) -- snapped to the nearest valid value that still fits. */
function snapRowsOffset(value: number): number {
  if (!isOffsetTechnique(props.pattern.technique)) {
    return clamp(Math.round(value), maxRowsOffset.value)
  }
  const evenMax = maxRowsOffset.value - (maxRowsOffset.value % 2)
  return Math.min(evenMax, Math.round(clamp(value, maxRowsOffset.value) / 2) * 2)
}

// Keeps a stored offset valid as the typed target size changes underneath an already-hovered choice.
watch(
  [maxColumnsOffset, maxRowsOffset, () => props.pattern.technique],
  () => {
    offset.value = { columns: clamp(offset.value.columns, maxColumnsOffset.value), rows: snapRowsOffset(offset.value.rows) }
  },
  { immediate: true },
)

function onPointer(event: PointerEvent) {
  const frameEl = event.currentTarget as HTMLElement
  const rect = frameEl.getBoundingClientRect()

  // The pointer's cell position, centered on the target window it would land -- so the window follows the pointer rather than always starting at it.
  const acrossCell = ((event.clientX - rect.left) / displayWidth.value) * viewAcross.value - targetAcross.value / 2
  const downCell = ((event.clientY - rect.top) / displayHeight.value) * viewDown.value - targetDown.value / 2
  const [columns, rows] = swapped.value ? [downCell, acrossCell] : [acrossCell, downCell]

  offset.value = { columns: clamp(Math.round(columns), maxColumnsOffset.value), rows: snapRowsOffset(rows) }
}

const acrossOffset = computed(() => (swapped.value ? offset.value.rows : offset.value.columns))
const downOffset = computed(() => (swapped.value ? offset.value.columns : offset.value.rows))

const keptStyle = computed(() => ({
  left: `${(acrossOffset.value / viewAcross.value) * 100}%`,
  top: `${(downOffset.value / viewDown.value) * 100}%`,
  width: `${(targetAcross.value / viewAcross.value) * 100}%`,
  height: `${(targetDown.value / viewDown.value) * 100}%`,
}))
</script>

<template>
  <div class="crop-picker">
    <p class="crop-picker__hint">{{ t.changeSize.cropHint }}</p>
    <div
      class="crop-picker__frame"
      role="img"
      :aria-label="t.changeSize.cropPickerLabel"
      data-testid="crop-picker"
      :style="{ width: `${displayWidth}px`, height: `${displayHeight}px` }"
      @pointerdown="onPointer"
      @pointermove="onPointer"
    >
      <canvas ref="canvasEl" class="crop-picker__picture" />
      <div class="crop-picker__kept" data-testid="crop-picker-kept" :style="keptStyle" />
    </div>
  </div>
</template>

<style scoped>
.crop-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.crop-picker__hint {
  margin: 0;
  font: var(--type-small);
  color: var(--muted);
}

.crop-picker__frame {
  position: relative;
  overflow: hidden;
  max-width: 100%;
  background: var(--board);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-md);
  cursor: crosshair;
  touch-action: none;
}

.crop-picker__picture {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

/* The kept region: everything outside it is dimmed by one giant shadow, clipped to the frame's own edges. */
.crop-picker__kept {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--accent-strong);
  box-shadow: 0 0 0 9999px var(--framing-dim);
  pointer-events: none;
}
</style>
