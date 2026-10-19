<script setup lang="ts">
import { computed } from 'vue'
import { describeWeave, type Technique } from '../../domain/weave'

// The plain picture a Template card carries until its artwork lands (ticket 493, 0494): a Frame-shaped lattice of bead
// marks in the Template's Technique, so peyote and brick look offset and loom lines up. Decorative.
const props = defineProps<{
  technique: Technique
  /** The Template's default size, whose shape the lattice takes. */
  columns: number
  rows: number
}>()

const MAX_SIDE = 7
const MIN_SIDE = 3

/** The lattice's beads across and down: the Frame's own proportions, held to a few marks a side. */
const lattice = computed(() => {
  const long = Math.max(props.columns, props.rows)
  const scale = MAX_SIDE / long
  const across = Math.max(MIN_SIDE, Math.min(MAX_SIDE, Math.round(props.columns * scale)))
  const down = Math.max(MIN_SIDE, Math.min(MAX_SIDE, Math.round(props.rows * scale)))
  const shifted = describeWeave({ technique: props.technique }).shifted
  const marks = Array.from({ length: down }, (_row, row) =>
    Array.from({ length: across }, (_column, column) => ({ x: column + 0.5 + (shifted && row % 2 === 1 ? 0.5 : 0), y: row + 0.5, key: `${row}-${column}` })),
  ).flat()
  return { width: across + (shifted ? 0.5 : 0), height: down, marks }
})
</script>

<template>
  <svg class="template-picture" :viewBox="`0 0 ${lattice.width} ${lattice.height}`" aria-hidden="true" focusable="false">
    <rect v-for="mark in lattice.marks" :key="mark.key" :x="mark.x - 0.4" :y="mark.y - 0.4" width="0.8" height="0.8" rx="0.2" />
  </svg>
</template>

<style scoped>
.template-picture {
  display: block;
  width: 100%;
  height: 100%;
  fill: var(--faint);
}
</style>
