<script setup lang="ts">
import { computed } from 'vue'
import {
  CELL_SIZE_PX,
  GRID_BORDER_PX,
  RULER_GUTTER_PX,
  gridHeightPx,
  gridWidthPx,
  rowHeightPx,
  rowOffsetPx,
  rulerLabelStep,
} from '../domain/grid'
import type { Pattern } from '../domain/pattern'

const props = defineProps<{
  pattern: Pattern
  /** Which way the ruler counts: down the rows, or across the columns. */
  axis: 'row' | 'column'
  /** Which side of the grid this gutter sits on — left/top, or right/bottom. */
  edge: 'start' | 'end'
  zoom: number
}>()

/** Numbers stay this big on screen whatever the zoom, so the ruler thins out instead of shrinking into illegibility. */
const FONT_SIZE_PX = 11
const LABEL_GAP_PX = 4
/** A row number needs about a line of height to itself; a column number needs its own width. */
const MIN_ROW_LABEL_PX = 13
const MIN_COLUMN_LABEL_PX = 20

/*
 * The gutter is aria-hidden: the numbers only mean anything next to the grid they line up with, and there are four
 * gutters, so reading them out would be noise rather than orientation.
 */

/** Undo the canvas scale, so a length written here comes out the same on screen at every zoom level. */
function unscaled(px: number): string {
  return `${px / props.zoom}px`
}

const isRowRuler = computed(() => props.axis === 'row')

/** Distance from one row's (or column's) start to the next, per the Pattern's technique — peyote's rows pack tighter. */
const spacingPx = computed(() =>
  isRowRuler.value ? rowHeightPx(props.pattern.technique) : CELL_SIZE_PX,
)

const count = computed(() => (isRowRuler.value ? props.pattern.rows : props.pattern.columns))

const step = computed(() =>
  rulerLabelStep(
    spacingPx.value,
    props.zoom,
    isRowRuler.value ? MIN_ROW_LABEL_PX : MIN_COLUMN_LABEL_PX,
  ),
)

/**
 * How far a column gutter's numbers shift sideways to sit over the beads they count: it follows the row it runs
 * along — the first row along the top, the last one underneath — and an offset technique shifts alternate rows by
 * half a bead. Row gutters don't shift: staggering their numbers row by row would read as jitter rather than
 * alignment, and the row rulers already follow the technique through their spacing.
 */
function columnOffsetPx(): number {
  return rowOffsetPx(props.pattern.technique, props.edge === 'start' ? 0 : props.pattern.rows - 1)
}

interface RulerLabel {
  index: number
  number: number
  alongPx: number
}

const labels = computed<RulerLabel[]>(() =>
  Array.from({ length: count.value }, (_unused, index) => index)
    .filter((index) => (index + 1) % step.value === 0)
    .map((index) => ({
      index,
      number: index + 1,
      // The grid's outline sits between the gutter and the first bead, so every label starts past it.
      alongPx: GRID_BORDER_PX + index * spacingPx.value,
    })),
)

const gutterStyle = computed(() =>
  isRowRuler.value
    ? {
        width: unscaled(RULER_GUTTER_PX),
        height: `${gridHeightPx(props.pattern.technique, props.pattern.rows) + GRID_BORDER_PX * 2}px`,
        fontSize: unscaled(FONT_SIZE_PX),
      }
    : {
        width: `${gridWidthPx(props.pattern.technique, props.pattern.columns) + GRID_BORDER_PX * 2}px`,
        height: unscaled(RULER_GUTTER_PX),
        fontSize: unscaled(FONT_SIZE_PX),
      },
)

function labelStyle(label: RulerLabel) {
  return isRowRuler.value
    ? {
        top: `${label.alongPx}px`,
        height: `${CELL_SIZE_PX}px`,
        left: '0',
        right: '0',
        paddingInline: unscaled(LABEL_GAP_PX),
      }
    : {
        left: `${label.alongPx + columnOffsetPx()}px`,
        width: `${CELL_SIZE_PX}px`,
        top: '0',
        bottom: '0',
      }
}
</script>

<template>
  <div
    class="pattern-ruler"
    :class="[`pattern-ruler--${axis}`, `pattern-ruler--${edge}`]"
    :data-testid="`pattern-ruler-${axis}-${edge}`"
    :style="gutterStyle"
    aria-hidden="true"
  >
    <span
      v-for="label in labels"
      :key="label.index"
      class="pattern-ruler__label"
      data-testid="ruler-label"
      :style="labelStyle(label)"
    >
      {{ label.number }}
    </span>
  </div>
</template>

<style scoped>
.pattern-ruler {
  position: relative;
  flex: none;
  color: var(--color-ink);
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.pattern-ruler__label {
  position: absolute;
  display: flex;
  align-items: center;
  /* A number wider than its bead spills into the neighbouring gutter space rather than being clipped. */
  overflow: visible;
  white-space: nowrap;
}

.pattern-ruler--row.pattern-ruler--start .pattern-ruler__label {
  justify-content: flex-end;
}

.pattern-ruler--row.pattern-ruler--end .pattern-ruler__label {
  justify-content: flex-start;
}

.pattern-ruler--column .pattern-ruler__label {
  justify-content: center;
}
</style>
