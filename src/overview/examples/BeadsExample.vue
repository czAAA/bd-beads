<script setup lang="ts">
import { computed } from 'vue'
import { findBead } from '../../domain/beads'
import { findPaletteColorByHex } from '../../domain/palette'
import { formatPrintedGrams, printedGrams } from '../../domain/printGrams'
import { tourFinishedGrid } from '../../domain/tour'
import { useI18n } from '../../i18n/useI18n'
import BeadPicture from './BeadPicture.vue'
import ExampleFrame from './ExampleFrame.vue'

/** Beads needed (ticket 218): the Tour Project and its shopping list, counted off the Project and weighed as the exports weigh. */
const { t, locale } = useI18n()
const GRID = tourFinishedGrid()
const BEAD = findBead('miyuki-delica-11-0')

const lines = computed(() => {
  const counts = new Map<string, number>()
  for (const cell of GRID.flat()) if (cell.color) counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1)
  const weigh = (count: number) => `≈ ${formatPrintedGrams(printedGrams(count, BEAD) ?? 0, locale.value, t.value.quantities.gramsUnit)}`
  const colors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex, count]) => ({ hex, name: t.value.colorNames[findPaletteColorByHex(hex)?.id ?? ''] ?? hex, count, grams: weigh(count) }))
  const total = colors.reduce((sum, line) => sum + line.count, 0)
  return { colors, total, totalGrams: weigh(total) }
})
</script>

<template>
  <ExampleFrame>
    <BeadPicture :grid="GRID" :zoom="0.2" />
    <div class="beads">
      <h4 class="beads__heading">{{ t.quantities.heading }} · {{ lines.total }}</h4>
      <div v-for="line in lines.colors" :key="line.hex" class="beads__row">
        <i class="beads__swatch" :style="{ background: line.hex }" />
        <span>{{ line.name }}</span>
        <span class="beads__number">{{ line.count }}</span>
        <span class="ex-label">{{ line.grams }}</span>
      </div>
      <div class="beads__row beads__row--total">
        <i />
        <span>{{ t.quantities.totalLabel }}</span>
        <span class="beads__number">{{ lines.total }}</span>
        <span class="ex-label">{{ lines.totalGrams }}</span>
      </div>
    </div>
  </ExampleFrame>
</template>

<style scoped>
.beads {
  min-width: 13.125rem;
  padding: var(--space-10) var(--space-14);
  font: var(--type-body);
  color: var(--ink);
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}

.beads__heading {
  margin: 0 0 var(--space-4);
  font: var(--type-control);
}

.beads__row {
  display: grid;
  grid-template-columns: 0.875rem 1fr auto auto;
  gap: var(--space-10);
  align-items: center;
  padding: var(--space-6) 0;
  border-top: 1px solid var(--line-soft);
}

.beads__heading + .beads__row {
  border-top: 0;
}

.beads__row--total {
  font-weight: 600;
}

.beads__swatch {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: var(--radius-xs);
  /* A black bead on a dark list still shows. */
  box-shadow: inset 0 0 0 1px var(--line);
}

.beads__number {
  font: var(--type-meta-small);
}
</style>
