<script setup lang="ts">
import { letterInk } from '../../rendering/beadLook'

// A color as a disc holding its Swatch letter, white on a dark bead and `ink` on a light one: the margin sheet's legend
// and the expanded rail's Beads needed (MarginSheet card, tickets 1258, 1260).
defineProps<{
  hex: string
  /** The color's Swatch letter; "?" for a color with none, as the Word chart does. */
  letter?: string
}>()
</script>

<template>
  <span class="letter-disc" :style="{ background: hex, color: letterInk(hex) }">{{ letter ?? '?' }}</span>
</template>

<style scoped>
/* 14px, its letter Inter 600 8. */
.letter-disc {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--margin-legend-disc);
  height: var(--margin-legend-disc);
  font: var(--margin-legend-letter);
  border-radius: var(--radius-full);
  box-shadow: 0 0 0 1px var(--swatch-edge);
}
</style>
