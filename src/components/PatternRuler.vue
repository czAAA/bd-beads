<script setup lang="ts">
import { computed } from 'vue'
import {
  CELL_SIZE_PX,
  GRID_BORDER_PX,
  RULER_GUTTER_PX,
  rowOffsetPx,
  rulerLabelStep,
} from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import { wholeLineSelection, type Selection } from '../domain/selection'
import { useI18n } from '../i18n/useI18n'
import { patternExtentPx, rowPitchPx } from '../rendering/patternRenderer'

const props = defineProps<{
  pattern: Pattern
  /** Which way the ruler counts: down the rows, or across the columns. */
  axis: 'row' | 'column'
  /** Which side of the grid this gutter sits on — left/top, or right/bottom. */
  edge: 'start' | 'end'
  zoom: number
  /** The bead cursor's row or column on this ruler's axis (ticket 159): always numbered, and marked. */
  cursorIndex?: number
}>()

const emit = defineEmits<{
  /** A ruler number was clicked (ticket 123): the Selection of that whole row/column, ready to hand to whatever else the app does with a Selection. */
  select: [selection: Selection]
}>()

const { t } = useI18n()

/** Numbers stay this big on screen whatever the zoom, so the ruler thins out instead of shrinking into illegibility. */
const FONT_SIZE_PX = 11
const LABEL_GAP_PX = 4
/** A row number needs about a line of height to itself; a column number needs its own width. */
const MIN_ROW_LABEL_PX = 13
const MIN_COLUMN_LABEL_PX = 20

/*
 * Each number is a button now (ticket 123): clicking it selects that whole row/column, the same Selection a
 * Select-tool drag across it would leave (see wholeLineSelection). They carry their own accessible name
 * (t.rulers.selectRowLabel/selectColumnLabel) rather than being hidden from assistive technology, since they now do
 * something rather than merely label the grid.
 */

/** Undo the canvas scale, so a length written here comes out the same on screen at every zoom level. */
function unscaled(px: number): string {
  return `${px / props.zoom}px`
}

const isRowRuler = computed(() => props.axis === 'row')

/** Distance from one row's (or column's) start to the next, as the Pattern renderer draws it: peyote's rows pack tighter, brick stitch's are a seam further apart. */
const spacingPx = computed(() =>
  isRowRuler.value ? rowPitchPx(props.pattern.technique) : CELL_SIZE_PX,
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
  /** The row (or column) being woven now, while Row progress is on: always numbered, in bold `marker` (BeadBoard card). */
  current: boolean
  /** The bead cursor's row or column (BeadCursor card): `ink`, bold, with a `focus-ring` line under it. */
  cursor: boolean
}

/** The line Row progress is on along this ruler's axis, or -1 when there is none to mark. */
const currentIndex = computed(() => {
  const progress = props.pattern.rowProgress
  if (!progress.enabled) return -1
  if (isRowRuler.value) return progress.direction === 'rows' ? progress.currentRow : -1
  return progress.direction === 'columns' ? progress.currentColumn : -1
})

const labels = computed<RulerLabel[]>(() =>
  Array.from({ length: count.value }, (_unused, index) => index)
    .filter((index) => (index + 1) % step.value === 0 || index === currentIndex.value || index === props.cursorIndex)
    .map((index) => ({
      index,
      number: index + 1,
      // The board's padding sits between the gutter and the first bead, so every label starts past it.
      alongPx: GRID_BORDER_PX + index * spacingPx.value,
      current: index === currentIndex.value,
      cursor: index === props.cursorIndex,
    })),
)

const extent = computed(() => patternExtentPx(props.pattern.technique, props.pattern.columns, props.pattern.rows))

const gutterStyle = computed(() =>
  isRowRuler.value
    ? {
        width: unscaled(RULER_GUTTER_PX),
        height: `${extent.value.height + GRID_BORDER_PX * 2}px`,
        fontSize: unscaled(FONT_SIZE_PX),
      }
    : {
        width: `${extent.value.width + GRID_BORDER_PX * 2}px`,
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

function labelAriaLabel(label: RulerLabel): string {
  return (isRowRuler.value ? t.value.rulers.selectRowLabel : t.value.rulers.selectColumnLabel).replace(
    '{number}',
    String(label.number),
  )
}

function onLabelClick(label: RulerLabel) {
  emit('select', wholeLineSelection(props.pattern, props.axis, label.index))
}
</script>

<template>
  <div
    class="pattern-ruler"
    :class="[`pattern-ruler--${axis}`, `pattern-ruler--${edge}`]"
    :data-testid="`pattern-ruler-${axis}-${edge}`"
    :style="gutterStyle"
  >
    <button
      v-for="label in labels"
      :key="label.index"
      type="button"
      class="ui-control pattern-ruler__label"
      :class="{ 'pattern-ruler__label--current': label.current, 'pattern-ruler__label--cursor': label.cursor }"
      data-testid="ruler-label"
      :aria-label="labelAriaLabel(label)"
      :style="labelStyle(label)"
      @click="onLabelClick(label)"
    >
      {{ label.number }}
    </button>
  </div>
</template>

<style scoped>
/* The ruler role (DESIGN.md §3 → tokens.json type): DM Mono 11 in `ruler`; its size is set, unscaled, by gutterStyle. */
.pattern-ruler {
  position: relative;
  flex: none;
  font-family: var(--font-mono);
  font-weight: 400;
  line-height: 1;
  color: var(--ruler);
}

.pattern-ruler__label--current {
  font-weight: 700;
  color: var(--marker);
}

.pattern-ruler__label--cursor {
  font-weight: 700;
  color: var(--ink);
  text-decoration: underline 2px var(--focus-ring);
  text-underline-offset: 2px;
}

.pattern-ruler__label {
  position: absolute;
  display: flex;
  align-items: center;
  /* A number wider than its bead spills into the neighbouring gutter space rather than being clipped. */
  overflow: visible;
  white-space: nowrap;
  /* Reset the app's default pill-button chrome: this reads as a plain number until hovered/focused. */
  font: inherit;
  font-weight: inherit;
  color: inherit;
  background: none;
  border: none;
  border-radius: var(--radius-xs);
  padding: 0;
  cursor: pointer;
}

@media (hover: hover) {
  .pattern-ruler__label:hover {
    color: var(--ink);
    background: var(--hover-fill);
  }
}

.pattern-ruler__label:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 0;
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
