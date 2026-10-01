<script setup lang="ts">
import { computed } from 'vue'
import {
  CELL_SIZE_PX,
  GRID_BORDER_PX,
  RULER_GUTTER_PX,
  rowOffsetPx,
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
  /** The bead cursor's row or column on this ruler's axis (ticket 159): marked. */
  cursorIndex?: number
}>()

const emit = defineEmits<{
  /** A ruler number was clicked (ticket 123): the Selection of that whole row/column, ready to hand to whatever else the app does with a Selection. */
  select: [selection: Selection]
}>()

const { t } = useI18n()

/** Every 5th number is a landmark, bold in `body`; the rest are regular in `ruler` (Rulers card). */
const LANDMARK_EVERY = 5
/** Column numbers from 100 are turned a quarter turn, so three digits take no more width than two. Row numbers stay horizontal. */
const TURN_FROM = 100
const LABEL_GAP_PX = 4

/*
 * Each number is a button now (ticket 123): clicking it selects that whole row/column, the same Selection a
 * Select-tool drag across it would leave (see wholeLineSelection). They carry their own accessible name
 * (t.rulers.selectRowLabel/selectColumnLabel) rather than being hidden from assistive technology, since they now do
 * something rather than merely label the grid.
 */

const isRowRuler = computed(() => props.axis === 'row')

/** Distance from one row's (or column's) start to the next, as the Pattern renderer draws it: peyote's rows pack tighter, brick stitch's are a seam further apart. */
const spacingPx = computed(() =>
  isRowRuler.value ? rowPitchPx(props.pattern.technique) : CELL_SIZE_PX,
)

const count = computed(() => (isRowRuler.value ? props.pattern.rows : props.pattern.columns))

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
  /** The row (or column) being woven now, while Row progress is on: in bold `marker` (BeadBoard card). */
  current: boolean
  /** The bead cursor's row or column (BeadCursor card): `ink`, bold, with a `focus-ring` line under it. */
  cursor: boolean
  /** Every 5th number (unless the current or cursor style takes over): bold in `body`. */
  landmark: boolean
  /** A column number of 100 or more, turned a quarter turn to read upward. */
  rotated: boolean
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
    .map((index) => ({
      index,
      number: index + 1,
      // The board's padding sits between the gutter and the first bead, so every label starts past it.
      alongPx: GRID_BORDER_PX + index * spacingPx.value,
      current: index === currentIndex.value,
      cursor: index === props.cursorIndex,
      landmark: (index + 1) % LANDMARK_EVERY === 0 && index !== currentIndex.value && index !== props.cursorIndex,
      rotated: !isRowRuler.value && index + 1 >= TURN_FROM,
    })),
)

const extent = computed(() => patternExtentPx(props.pattern.technique, props.pattern.columns, props.pattern.rows))

const gutterStyle = computed(() =>
  isRowRuler.value
    ? {
        width: `${RULER_GUTTER_PX}px`,
        height: `${extent.value.height + GRID_BORDER_PX * 2}px`,
      }
    : {
        width: `${extent.value.width + GRID_BORDER_PX * 2}px`,
        height: `${RULER_GUTTER_PX}px`,
      },
)

function labelStyle(label: RulerLabel) {
  return isRowRuler.value
    ? {
        top: `${label.alongPx}px`,
        height: `${CELL_SIZE_PX}px`,
        left: '0',
        right: '0',
        paddingInline: `${LABEL_GAP_PX}px`,
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
    data-tour="ruler"
    :style="gutterStyle"
  >
    <button
      v-for="label in labels"
      :key="label.index"
      type="button"
      class="ui-control pattern-ruler__label"
      :class="{
        'pattern-ruler__label--landmark': label.landmark,
        'pattern-ruler__label--rotated': label.rotated,
        'pattern-ruler__label--current': label.current,
        'pattern-ruler__label--cursor': label.cursor,
      }"
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
/* The ruler role (DESIGN.md §3 → tokens.json type): DM Mono 11 in `ruler`, 12 on a phone (below `bp-tablet`). */
.pattern-ruler {
  position: relative;
  flex: none;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  color: var(--ruler);
}

.pattern-ruler__label--landmark {
  font-weight: 700;
  color: var(--body);
}

/* Read upward (`sideways-lr`), so a cursor underline stays under the digits in their own direction. */
.pattern-ruler__label--rotated {
  writing-mode: sideways-lr;
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

/*
 * Column numbers sit at the bead-side end of their gutter, 3px off the board, whether horizontal or turned. A turned
 * number's line starts at the bottom, so its bead-side end is flex-start on the top ruler and flex-end on the bottom
 * one; the 3px padding stays the same physical side.
 */
.pattern-ruler--column .pattern-ruler__label {
  justify-content: center;
}

.pattern-ruler--column.pattern-ruler--start .pattern-ruler__label {
  align-items: flex-end;
  padding-bottom: 3px;
}

.pattern-ruler--column.pattern-ruler--end .pattern-ruler__label {
  align-items: flex-start;
  padding-top: 3px;
}

.pattern-ruler--column.pattern-ruler--start .pattern-ruler__label--rotated {
  align-items: center;
  justify-content: flex-start;
}

.pattern-ruler--column.pattern-ruler--end .pattern-ruler__label--rotated {
  align-items: center;
  justify-content: flex-end;
}

@media (max-width: 743px) {
  .pattern-ruler {
    font-size: 12px;
  }
}
</style>
