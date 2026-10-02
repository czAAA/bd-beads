<script setup lang="ts">
/**
 * The background highlight behind the board (ticket 143; BeadBoard card): the open Pattern's Technique as one large,
 * faint Instrument Serif word, anchored bottom-right and partly covered by the board, and one soft curve sweeping from
 * the lower left up to the upper right. Decoration only: hidden from assistive tech, never interactive, and not part of
 * any export (the exports draw the Pattern alone).
 */
defineProps<{ word: string }>()
</script>

<template>
  <div class="canvas-backdrop" aria-hidden="true" data-testid="canvas-backdrop">
    <svg class="canvas-backdrop__curve" viewBox="0 0 1000 700" preserveAspectRatio="none" focusable="false">
      <path d="M-20 640 C 200 740, 380 420, 560 380 S 860 520, 1020 60" vector-effect="non-scaling-stroke" />
    </svg>
    <span class="canvas-backdrop__word">{{ word }}</span>
  </div>
</template>

<style scoped>
.canvas-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
}

.canvas-backdrop__curve {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.canvas-backdrop__curve path {
  fill: none;
  stroke: var(--curve);
  stroke-width: 1.5;
}

.canvas-backdrop__word {
  position: absolute;
  right: calc(var(--space-8) * -1);
  bottom: calc((var(--space-32) + var(--space-8)) * -1);
  font: var(--type-word);
  letter-spacing: var(--tracking-word);
  color: var(--word);
  white-space: nowrap;
}
</style>
