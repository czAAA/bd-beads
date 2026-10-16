<script setup lang="ts">
/**
 * The background highlight behind the board (ticket 143; BeadBoard card): the open Project's Technique as one large,
 * faint Instrument Serif word, anchored bottom-right, and one soft curve sweeping from the lower left up to the upper
 * right. The curve sits behind the board; the word is painted over it (faint, so the beads show through) at one fixed
 * size, wholly inside the drawing area, so zooming the board in or out neither crops nor shrinks it. Decoration only:
 * hidden from assistive tech, never interactive, and not part of any export (the exports draw the Project alone).
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
  right: var(--space-8);
  bottom: 0;
  z-index: calc(var(--z-canvas-overlay) - 1);
  font: var(--type-word);
  letter-spacing: var(--tracking-word);
  color: var(--word);
  opacity: var(--word-opacity);
  white-space: nowrap;
}
</style>
