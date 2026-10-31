<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_BEAD } from '../../domain/beads'
import { beadCell, DEFAULT_TECHNIQUE } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import { positionMarkBackground } from '../../rendering/positionMarks'
import { useCanvasBackground } from '../../theme/useCanvasBackground'

/** The canvas box with no Project open (tickets 158, 0748; EmptyCanvas card): the empty positions of New Project's
 * default Technique and Bead at 100%, on the Canvas's last Background, then the message and the slot. */
const { t } = useI18n()
const canvasBackground = useCanvasBackground()
const DEFAULT_CELL = beadCell(DEFAULT_BEAD, DEFAULT_TECHNIQUE)
const boardStyle = computed(() => {
  const pixelRatio = window.devicePixelRatio || 1
  const marks = positionMarkBackground({
    technique: DEFAULT_TECHNIQUE,
    cell: DEFAULT_CELL,
    deviceScale: pixelRatio,
    pixelRatio,
    color: canvasBackground.projectTheme.value.positionMark,
  })
  return marks ? { '--empty-marks': `url(${marks.url})`, '--empty-marks-size': `${marks.width}px ${marks.height}px` } : undefined
})
</script>

<template>
  <div class="empty-canvas" data-testid="app-canvas-placeholder">
    <!-- The positions fill the entire container, behind the message. -->
    <span class="empty-canvas__board" :style="boardStyle" aria-hidden="true" />
    <div class="empty-canvas__message">
      <p class="empty-canvas__title">{{ t.shell.canvasPlaceholder }}</p>
      <p class="empty-canvas__hint">{{ t.shell.canvasPlaceholderHint }}</p>
      <slot />
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

/* The empty positions: cover the whole container, over the drawing area's Background. */
.empty-canvas__board {
  position: absolute;
  inset: 0;
  background: var(--empty-marks, none) 0 0 / var(--empty-marks-size, auto) repeat;
}

/* Message floats in the centre, over the positions. */
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
