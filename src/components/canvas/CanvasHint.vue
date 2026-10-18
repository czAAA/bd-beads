<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import KeyChip from '../ui/KeyChip.vue'
import { useKeyHints } from '../../composables/ui/useKeyHints'
import { TOOL_HOTKEYS } from '../tools/toolIcons'

// The one line under the strip while the Project has no beads (ticket 429; CanvasHint card): "scroll or space drag to
// move · ⌘ scroll to zoom · 5 Hand · R Rulers". Fixed to the drawing area, decoration (shortcuts are in Keyboard
// shortcuts), left out on phone; ⌘ reads "Ctrl" on Windows/Linux.
const { t } = useI18n()
/** The line is made of key chips, so it goes when they do (ticket 438). */
const { shown } = useKeyHints()

/** Whether this is an Apple device, where the zoom key is ⌘. */
const apple = computed(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || navigator.platform || ''))
</script>

<template>
  <p v-if="shown" class="canvas-hint" data-testid="canvas-hint" aria-hidden="true">
    <span>{{ t.canvas.hint.scrollOr }}</span>
    <KeyChip class="hint-chip canvas-hint__key">{{ t.canvas.hint.spaceKey }}</KeyChip>
    <span>{{ t.canvas.hint.dragToMove }}</span>
    <span class="canvas-hint__dot">·</span>
    <KeyChip class="hint-chip canvas-hint__key">{{ apple ? '⌘' : 'Ctrl' }}</KeyChip>
    <span>{{ t.canvas.hint.scrollToZoom }}</span>
    <span class="canvas-hint__dot">·</span>
    <KeyChip class="hint-chip canvas-hint__key">{{ TOOL_HOTKEYS.hand }}</KeyChip>
    <span>{{ t.canvas.hint.hand }}</span>
    <span class="canvas-hint__dot">·</span>
    <KeyChip class="hint-chip canvas-hint__key">R</KeyChip>
    <span>{{ t.canvas.hint.rulers }}</span>
  </p>
</template>

<style scoped>
.canvas-hint {
  position: absolute;
  top: var(--space-12);
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 2 * var(--space-16));
  justify-content: center;
  z-index: var(--z-canvas-overlay);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-6);
  margin: 0;
  font: 400 0.75rem/1rem var(--font-sans);
  color: var(--muted);
  pointer-events: none;
}

/* A phone has no wheel and no keyboard to hint at (CanvasHint card); the width is controls.css's phone width. */
@media (max-width: 30rem) {
  .canvas-hint {
    display: none;
  }
}

.canvas-hint__dot {
  margin: 0 var(--space-4);
}

/* A Kbd chip, 20px here (CanvasHint card): DM Mono on the shared `.hint-chip` box (controls.css). */
.canvas-hint__key {
  font: var(--type-meta-small);
}
</style>
