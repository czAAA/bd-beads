<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { computeFitZoom, gridHeightPx, gridWidthPx } from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import { useI18n } from '../i18n/useI18n'
import PatternGrid from './PatternGrid.vue'

const props = defineProps<{ pattern: Pattern }>()
const emit = defineEmits<{
  'cell-click': [row: number, column: number]
}>()
const { t } = useI18n()

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25
/** The canvas box's own content size (see .pattern-canvas__viewport); fit-zoom math targets this. */
const VIEWPORT_SIZE_PX = 480

function fitZoomFor(pattern: Pattern): number {
  return computeFitZoom({
    columns: pattern.columns,
    rows: pattern.rows,
    maxWidth: VIEWPORT_SIZE_PX,
    maxHeight: VIEWPORT_SIZE_PX,
    technique: pattern.technique,
  })
}

const zoom = ref(fitZoomFor(props.pattern))

watch(
  () => props.pattern.id,
  () => {
    zoom.value = fitZoomFor(props.pattern)
  },
)

function clamp(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

function zoomIn() {
  zoom.value = clamp(zoom.value + ZOOM_STEP)
}

function zoomOut() {
  zoom.value = clamp(zoom.value - ZOOM_STEP)
}

function resetZoom() {
  zoom.value = fitZoomFor(props.pattern)
}

const zoomPercent = computed(() => Math.round(zoom.value * 100))
const scaledWidth = computed(
  () => gridWidthPx(props.pattern.technique, props.pattern.columns) * zoom.value,
)
const scaledHeight = computed(
  () => gridHeightPx(props.pattern.technique, props.pattern.rows) * zoom.value,
)
</script>

<template>
  <div class="pattern-canvas">
    <div class="pattern-canvas__controls">
      <button
        type="button"
        data-testid="zoom-out"
        :aria-label="t.canvas.zoomOutLabel"
        @click="zoomOut"
      >
        −
      </button>
      <span class="pattern-canvas__level" data-testid="zoom-level">{{ zoomPercent }}%</span>
      <button
        type="button"
        data-testid="zoom-in"
        :aria-label="t.canvas.zoomInLabel"
        @click="zoomIn"
      >
        +
      </button>
      <button
        type="button"
        data-testid="zoom-reset"
        :aria-label="t.canvas.zoomResetLabel"
        @click="resetZoom"
      >
        ⤢
      </button>
    </div>

    <div
      class="pattern-canvas__viewport"
      data-testid="pattern-canvas-viewport"
      :style="{ width: `${VIEWPORT_SIZE_PX}px`, height: `${VIEWPORT_SIZE_PX}px` }"
    >
      <div
        class="pattern-canvas__frame"
        :style="{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }"
      >
        <div class="pattern-canvas__scaled" :style="{ transform: `scale(${zoom})` }">
          <PatternGrid :pattern="pattern" @cell-click="(row, column) => emit('cell-click', row, column)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pattern-canvas {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.pattern-canvas__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pattern-canvas__level {
  min-width: 3.5em;
  text-align: center;
  font-weight: var(--font-weight-bold);
}

.pattern-canvas__viewport {
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-paper);
  border-radius: var(--radius-md);
}

.pattern-canvas__frame {
  flex: none;
  overflow: hidden;
}

.pattern-canvas__scaled {
  display: inline-block;
  transform-origin: top left;
}
</style>
