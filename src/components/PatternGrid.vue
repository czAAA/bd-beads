<script setup lang="ts">
import { CELL_SIZE_PX, rowHeightPx, rowOffsetPx } from '../domain/grid'
import type { Pattern } from '../domain/pattern'

defineProps<{ pattern: Pattern }>()

/** Rows after the first pull up to sit rowHeightPx apart instead of a full cell apart; 0 for techniques that stack at full height. */
function rowOverlapPx(technique: Pattern['technique'], rowIndex: number): number {
  return rowIndex === 0 ? 0 : rowHeightPx(technique) - CELL_SIZE_PX
}
</script>

<template>
  <div class="pattern-grid" :class="`pattern-grid--${pattern.technique}`">
    <div
      v-for="(row, rowIndex) in pattern.grid"
      :key="rowIndex"
      class="pattern-grid__row"
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
