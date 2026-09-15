<script setup lang="ts">
import { CELL_SIZE_PX, rowHeightPx, rowOffsetPx } from '../domain/grid'
import type { Pattern } from '../domain/pattern'

const emit = defineEmits<{
  'cell-click': [row: number, column: number]
}>()

const props = defineProps<{ pattern: Pattern }>()

/** Rows after the first pull up to sit rowHeightPx apart instead of a full cell apart; 0 for techniques that stack at full height. */
function rowOverlapPx(technique: Pattern['technique'], rowIndex: number): number {
  return rowIndex === 0 ? 0 : rowHeightPx(technique) - CELL_SIZE_PX
}

/** How far through the weaving this row is, while the row-progress overlay is on (ticket 13). */
function rowProgressClass(rowIndex: number): string | null {
  const { enabled, currentRow } = props.pattern.rowProgress
  if (!enabled || rowIndex > currentRow) {
    return null
  }
  return rowIndex === currentRow ? 'pattern-grid__row--current' : 'pattern-grid__row--done'
}
</script>

<template>
  <div class="pattern-grid" :class="`pattern-grid--${pattern.technique}`">
    <div
      v-for="(row, rowIndex) in pattern.grid"
      :key="rowIndex"
      class="pattern-grid__row"
      :class="rowProgressClass(rowIndex)"
      data-testid="grid-row"
      :style="{
        marginLeft: `${rowOffsetPx(pattern.technique, rowIndex)}px`,
        marginTop: `${rowOverlapPx(pattern.technique, rowIndex)}px`,
      }"
    >
      <div
        v-for="(cell, columnIndex) in row"
        :key="columnIndex"
        class="pattern-grid__cell"
        data-testid="grid-cell"
        :style="{
          width: `${CELL_SIZE_PX}px`,
          height: `${CELL_SIZE_PX}px`,
          backgroundColor: cell.color ?? undefined,
        }"
        @click="emit('cell-click', rowIndex, columnIndex)"
      />
    </div>
  </div>
</template>

<style scoped>
.pattern-grid {
  display: inline-flex;
  flex-direction: column;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pattern-grid__row {
  display: flex;
}

.pattern-grid__cell {
  box-sizing: border-box;
  border: 1px solid var(--color-paper);
  background-color: var(--color-paper-solid);
  cursor: pointer;
}

/* Rows already woven step back so the eye lands on what's left to do. */
.pattern-grid__row--done {
  opacity: 0.35;
  filter: grayscale(1);
}

/* The row being woven now, lifted above its neighbours so its marker isn't buried under an overlapping row. */
.pattern-grid__row--current {
  position: relative;
  z-index: 1;
}

/*
 * The marker is its own layer over the row rather than an outline or an inset shadow: an outline on the first row
 * would be shaved off by .pattern-grid's overflow clipping, and an inset shadow would be painted over by the cells'
 * own opaque backgrounds. It ignores pointer events so the beads underneath stay paintable.
 */
.pattern-grid__row--current::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 3px var(--color-wedgewood);
  pointer-events: none;
}

/* Peyote's interlocking beads read as diamonds/hexes rather than a flat grid. */
.pattern-grid--peyote .pattern-grid__cell {
  border-radius: 30%;
}

/* Brick stitch keeps square cells but reads as coursed masonry via a bolder seam between rows. */
.pattern-grid--brick .pattern-grid__row {
  border-top: 1px solid var(--color-ink);
}

.pattern-grid--brick .pattern-grid__row:first-child {
  border-top: none;
}
</style>
