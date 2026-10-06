<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { FRAME_HOTKEY, TOOL_HOTKEYS } from '../tools/toolIcons'

/**
 * The one line in the drawing area's bottom-left corner that says how to move the open canvas and names its shortcuts
 * (CanvasHint card): "scroll or space drag to move · ⌘ scroll to zoom · 5 Hand · 6 Set Frame · R Rulers". It does not move
 * with the canvas, is decoration for the eye (the same shortcuts are in Keyboard shortcuts), and is left to the phone,
 * which has no wheel and no keyboard, to leave out. On Windows and Linux the ⌘ chip reads "Ctrl".
 */
const { t } = useI18n()

/** Whether this is an Apple device, where the zoom key is ⌘. */
const apple = computed(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || navigator.platform || ''))
</script>

<template>
  <p class="canvas-hint" data-testid="canvas-hint" aria-hidden="true">
    <span>{{ t.canvas.hint.scrollOr }}</span>
    <kbd class="canvas-hint__key">{{ t.canvas.hint.spaceKey }}</kbd>
    <span>{{ t.canvas.hint.dragToMove }}</span>
    <span class="canvas-hint__dot">·</span>
    <kbd class="canvas-hint__key">{{ apple ? '⌘' : 'Ctrl' }}</kbd>
    <span>{{ t.canvas.hint.scrollToZoom }}</span>
    <span class="canvas-hint__dot">·</span>
    <kbd class="canvas-hint__key">{{ TOOL_HOTKEYS.hand }}</kbd>
    <span>{{ t.canvas.hint.hand }}</span>
    <span class="canvas-hint__dot">·</span>
    <kbd class="canvas-hint__key">{{ FRAME_HOTKEY }}</kbd>
    <span>{{ t.canvas.hint.setFrame }}</span>
    <span class="canvas-hint__dot">·</span>
    <kbd class="canvas-hint__key">R</kbd>
    <span>{{ t.canvas.hint.rulers }}</span>
  </p>
</template>

<style scoped>
.canvas-hint {
  position: absolute;
  bottom: var(--space-12);
  left: 14px;
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

.canvas-hint__dot {
  margin: 0 var(--space-4);
}

/* A Kbd chip, 20px here (CanvasHint card): DM Mono, a 1px `line-strong` edge with a 2px bottom, on `elevated`. */
.canvas-hint__key {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-4);
  font: var(--type-meta-small);
  color: var(--body);
  background: var(--elevated);
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: var(--radius-xs);
}
</style>
