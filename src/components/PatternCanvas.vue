<script setup lang="ts">
import { computed } from 'vue'
import { canvasContentHeightPx, canvasContentWidthPx, type PreviewCell } from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import type { Selection } from '../domain/selection'
import PatternGrid from './PatternGrid.vue'
import PatternRuler from './PatternRuler.vue'
import ZoomControls from './ZoomControls.vue'

const props = defineProps<{
  pattern: Pattern
  zoom: number
  previewCells?: PreviewCell[]
  previewColor?: string | null
  selection?: Selection
}>()
const emit = defineEmits<{
  'cell-primary-down': [row: number, column: number]
  'cell-primary-move': [row: number, column: number]
  'cell-secondary-down': [row: number, column: number]
  'cell-secondary-move': [row: number, column: number]
  'cell-hover': [row: number, column: number]
  'hover-end': []
  'zoom-in': []
  'zoom-out': []
  'zoom-reset': []
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

/** The floating zoom stack's own readout: derived from the same zoom prop the grid scales by, rather than threaded down as a second prop (it's a pure Math.round(zoom * 100) either way — see usePatternZoom.ts). */
const zoomPercent = computed(() => Math.round(props.zoom * 100))
</script>

<template>
  <div class="pattern-canvas" data-testid="pattern-canvas-viewport" :style="contentStyle">
    <div class="pattern-canvas__clip">
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
              :selection="selection"
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

    <!--
      A later sibling of pattern-canvas__rotate, not a descendant of it (ticket 35): rotation/zoom in this app are
      view-only CSS transforms of that element alone (see rotateStyle/pattern-canvas__scaled above), so anything
      outside it — this stack included — never rotates or scales along with the Pattern. Being later in the DOM
      also means it paints on top of the grid without any extra z-index/pointer-events plumbing: whatever screen
      area it covers stops mouse events from ever reaching the grid cells underneath (see PatternGrid.vue, whose
      paint/erase/hover handlers live on the cells themselves), which is what keeps hovering or clicking the stack
      from painting, erasing, selecting or previewing anything.
    -->
    <div class="pattern-canvas__zoom-controls">
      <ZoomControls
        :zoom-percent="zoomPercent"
        @zoom-in="emit('zoom-in')"
        @zoom-out="emit('zoom-out')"
        @reset="emit('zoom-reset')"
      />
    </div>
  </div>
</template>

<style scoped>
/*
 * The box is the bounded notepad page: its size is set to the Pattern by contentStyle, so a wide-and-short or
 * narrow-and-tall Pattern gets a box its own shape rather than sitting in a fixed square (ticket 18). It's no
 * longer a scroll container itself (ticket 28). If a manual zoom-in makes this box bigger than the canvas area
 * around it, that area scrolls horizontally to reach the rest of it (App.vue's .app-shell__canvas); nothing
 * anywhere clips or scrolls vertically — a tall Pattern just grows this box, and the page, taller, and the
 * browser's own scrollbar reaches the rest of it.
 */
.pattern-canvas {
  position: relative;
  margin: 0 auto;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

/*
 * Clips only the rotated/scaled grid's own paint (rounding at odd zoom levels can bleed a fraction of a pixel past
 * its edge) — its own layer rather than overflow:hidden on .pattern-canvas itself (ticket 35), so the floating zoom
 * stack, a sibling positioned against the box below, is never clipped by it even on a Pattern small enough that its
 * box is smaller than the stack's own footprint.
 */
.pattern-canvas__clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
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

/* Floats along the box's right edge, vertically centered, at a fixed offset that doesn't scale with zoom (ticket 35). */
.pattern-canvas__zoom-controls {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  z-index: 1;
}

/* Ruler gutter, pattern, ruler gutter — in both directions, so the grid is numbered on all four sides. */
.pattern-canvas__ruled {
  display: grid;
  grid-template-columns: auto auto auto;
  grid-template-rows: auto auto auto;
}
</style>
