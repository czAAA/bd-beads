<script setup lang="ts">
import { useI18n } from '../i18n/useI18n'

/**
 * The canvas box with no Pattern open (ticket 158; EmptyCanvas card): the frame stays, and the drawing area shows an
 * empty board (the `board` with `bead-empty` beads, no curve or word), "No Pattern open yet" and one line on what to do.
 */
const { t } = useI18n()
</script>

<template>
  <div class="empty-canvas" data-testid="app-canvas-placeholder">
    <span class="empty-canvas__board" aria-hidden="true" />
    <p class="empty-canvas__title">{{ t.shell.canvasPlaceholder }}</p>
    <p class="empty-canvas__hint">{{ t.shell.canvasPlaceholderHint }}</p>
  </div>
</template>

<style scoped>
.empty-canvas {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-10);
  padding: var(--space-24) var(--space-16);
  text-align: center;
}

/* A small empty board: bead-empty beads in a 12px lattice on the board color. */
.empty-canvas__board {
  width: calc(var(--space-12) * 10);
  height: calc(var(--space-12) * 7.5);
  background: var(--board) radial-gradient(circle, var(--bead-empty) 0 36%, transparent 40%) var(--space-6) var(--space-6) /
    var(--space-12) var(--space-12);
  border-radius: var(--radius-lg);
}

.empty-canvas__title {
  margin: 0;
  font: var(--type-control);
  color: var(--ink);
}

.empty-canvas__hint {
  max-width: calc(var(--tooltip-wide) + var(--space-32) * 2);
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}
</style>
