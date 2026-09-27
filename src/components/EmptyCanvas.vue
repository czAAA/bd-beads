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
    <!-- Board fills the entire container; dots are behind the message. -->
    <span class="empty-canvas__board" aria-hidden="true" />
    <div class="empty-canvas__message">
      <p class="empty-canvas__title">{{ t.shell.canvasPlaceholder }}</p>
      <p class="empty-canvas__hint">{{ t.shell.canvasPlaceholderHint }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Fill the entire canvas box so the dot board stretches edge to edge. */
.empty-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 160px;
}

/* Dot board: covers the whole container. */
.empty-canvas__board {
  position: absolute;
  inset: 0;
  background: var(--board) radial-gradient(circle, var(--bead-empty) 0 36%, transparent 40%) var(--space-6) var(--space-6) /
    var(--space-12) var(--space-12);
}

/* Message floats in the centre; a translucent pad keeps the text readable over the dots. */
.empty-canvas__message {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-10);
  padding: var(--space-24) var(--space-16);
  text-align: center;
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
