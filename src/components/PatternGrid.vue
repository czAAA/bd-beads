<script setup lang="ts">
import type { Pattern } from '../domain/pattern'

defineProps<{ pattern: Pattern }>()
</script>

<template>
  <div class="pattern-grid">
    <div v-for="(row, rowIndex) in pattern.grid" :key="rowIndex" class="pattern-grid__row" data-testid="grid-row">
      <div
        v-for="(cell, columnIndex) in row"
        :key="columnIndex"
        class="pattern-grid__cell"
        data-testid="grid-cell"
        :style="{ backgroundColor: cell.color ?? undefined }"
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
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  border: 1px solid var(--color-paper);
  background-color: var(--color-paper-solid);
}
</style>
