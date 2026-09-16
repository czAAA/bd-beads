<script setup lang="ts">
import { computed } from 'vue'
import { canvasContentHeightPx, canvasContentWidthPx, type GridPosition } from '../domain/grid'
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
 * The Pattern's own footprint (columns × rows, per its technique), before the view-only rotated flag turns it on
 * screen (see Pattern.rotated) — this never itself swaps, since the grid/technique geometry is unaffected by that
 * flag (ticket 28).
 */
const unrotatedContentWidth = computed(() =>
  canvasContentWidthPx(props.pattern.technique, props.pattern.columns, props.zoom),
)
const unrotatedContentHeight = computed(() =>
  canvasContentHeightPx(props.pattern.technique, props.pattern.rows, props.zoom),
)

/**
 * The box hugs the Pattern: it's exactly as big as the zoomed Pattern and its rulers (ticket 18), with no cap of its
 * own (ticket 27) — the zoom passed in is already fit to the real canvas area upstream (see usePatternZoom), so at
 * the fit level this is already within the available space. Manually zooming in past that can still outgrow the
 * canvas area; the scrollbar for that lives one level up, on the canvas area itself (ticket 28), not here. When
 * rotated, the box's reserved footprint swaps to match the turned picture (ticket 28); the actual grid keeps its
 * own unrotated width/height (see pattern-canvas__rotate below) and is turned to fit inside it.
 */
const contentWidth = computed(() =>
  props.pattern.rotated ? unrotatedContentHeight.value : unrotatedContentWidth.value,
)
const contentHeight = computed(() =>
  props.pattern.rotated ? unrotatedContentWidth.value : unrotatedContentHeight.value,
)

/** The scaled content has no layout size of its own (transforms don't reflow), so the box states it explicitly — both for its own size and so an ancestor that scrolls can tell it's grown past the available space. */
const contentStyle = computed(() => ({
  width: `${contentWidth.value}px`,
  height: `${contentHeight.value}px`,
}))

/**
 * Centers the Pattern at its own natural (unrotated) size inside the box above, then turns it 90° about that center
 * when Pattern.rotated is on — a plain view rotation, like turning a photo, that never touches the grid or its
 * technique geometry (ticket 28). Centering (rather than anchoring a corner) is what makes a rotated box's bounding
 * footprint land exactly on the swapped contentWidth/contentHeight above with no manual offset math.
 */
const rotateStyle = computed(() => ({
  width: `${unrotatedContentWidth.value}px`,
  height: `${unrotatedContentHeight.value}px`,
  transform: `translate(-50%, -50%) rotate(${props.pattern.rotated ? 90 : 0}deg)`,
}))
</script>

<template>
  <div class="pattern-canvas" data-testid="pattern-canvas-viewport" :style="contentStyle">
    <div class="pattern-canvas__rotate" :style="rotateStyle">
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
 * The box is the bounded notepad page: its size is set to the Pattern by contentStyle, so a wide-and-short or
 * narrow-and-tall Pattern gets a box its own shape rather than sitting in a fixed square (ticket 18). It's no
 * longer a scroll container itself (ticket 28) — overflow:hidden here is purely to clip the scaled content's own
 * paint (rounding at odd zoom levels can bleed a fraction of a pixel past this box's edge). If a manual zoom-in
 * makes this box bigger than the canvas area around it, that area scrolls horizontally to reach the rest of it
 * (App.vue's .app-shell__canvas); nothing anywhere clips or scrolls vertically — a tall Pattern just grows this
 * box, and the page, taller, and the browser's own scrollbar reaches the rest of it.
 */
.pattern-canvas {
  position: relative;
  overflow: hidden;
  margin: 0 auto;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

/* Positioned at the box's center and sized to the Pattern's own (unrotated) footprint, then rotated about that same center — see rotateStyle. */
.pattern-canvas__rotate {
  position: absolute;
  top: 50%;
  left: 50%;
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
