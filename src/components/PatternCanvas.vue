<script setup lang="ts">
import { computed } from 'vue'
import {
  CANVAS_MAX_PX,
  canvasContentHeightPx,
  canvasContentWidthPx,
  type GridPosition,
} from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import PatternGrid from './PatternGrid.vue'
import PatternRuler from './PatternRuler.vue'

const props = defineProps<{
  pattern: Pattern
  zoom: number
  previewCells?: GridPosition[]
  previewColor?: string | null
}>()
const emit = defineEmits<{
  'cell-primary-down': [row: number, column: number]
  'cell-primary-move': [row: number, column: number]
  'cell-secondary-down': [row: number, column: number]
  'cell-secondary-move': [row: number, column: number]
  'cell-hover': [row: number, column: number]
  'hover-end': []
}>()

/**
 * The box hugs the Pattern: it's exactly as big as the zoomed Pattern and its rulers, until that would outgrow the
 * screen-bounded maximum, at which point the box stops there and scrolls (ticket 18).
 */
const contentWidth = computed(() =>
  canvasContentWidthPx(props.pattern.technique, props.pattern.columns, props.zoom),
)
const contentHeight = computed(() =>
  canvasContentHeightPx(props.pattern.technique, props.pattern.rows, props.zoom),
)

const boxStyle = computed(() => ({
  width: `${Math.min(CANVAS_MAX_PX, contentWidth.value)}px`,
  height: `${Math.min(CANVAS_MAX_PX, contentHeight.value)}px`,
}))

/** The scaled content has no layout size of its own (transforms don't reflow), so the frame states it for the scrollbars. */
const frameStyle = computed(() => ({
  width: `${contentWidth.value}px`,
  height: `${contentHeight.value}px`,
}))
</script>

<template>
  <div class="pattern-canvas" data-testid="pattern-canvas-viewport" :style="boxStyle">
    <div class="pattern-canvas__frame" :style="frameStyle">
      <div class="pattern-canvas__scaled" :style="{ transform: `scale(${zoom})` }">
        <div class="pattern-canvas__ruled">
          <span />
          <PatternRuler :pattern="pattern" axis="column" edge="start" :zoom="zoom" />
          <span />

          <PatternRuler :pattern="pattern" axis="row" edge="start" :zoom="zoom" />
          <PatternGrid
            :pattern="pattern"
            :preview-cells="previewCells"
            :preview-color="previewColor"
            @cell-primary-down="(row, column) => emit('cell-primary-down', row, column)"
            @cell-primary-move="(row, column) => emit('cell-primary-move', row, column)"
            @cell-secondary-down="(row, column) => emit('cell-secondary-down', row, column)"
            @cell-secondary-move="(row, column) => emit('cell-secondary-move', row, column)"
            @cell-hover="(row, column) => emit('cell-hover', row, column)"
            @hover-end="emit('hover-end')"
          />
          <PatternRuler :pattern="pattern" axis="row" edge="end" :zoom="zoom" />

          <span />
          <PatternRuler :pattern="pattern" axis="column" edge="end" :zoom="zoom" />
          <span />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * The box is the bounded notepad page: its frame is sized to the Pattern by boxStyle, so a wide-and-short or
 * narrow-and-tall Pattern gets a frame its own shape rather than sitting in a fixed square (ticket 18).
 */
.pattern-canvas {
  overflow: auto;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.pattern-canvas__frame {
  overflow: hidden;
}

.pattern-canvas__scaled {
  display: inline-block;
  transform-origin: top left;
}

/* Ruler gutter, pattern, ruler gutter — in both directions, so the grid is numbered on all four sides. */
.pattern-canvas__ruled {
  display: grid;
  grid-template-columns: auto auto auto;
  grid-template-rows: auto auto auto;
}
</style>
