<script setup lang="ts">
import { useI18n } from '../i18n/useI18n'
import IconButton from './IconButton.vue'

/**
 * The design system's ZoomPill (ticket 79; ZoomPill card): the phone's zoom control, floating in the Pattern's
 * bottom-right corner (out · level · in · fit) -- pinch zooms and two fingers pan, so this is for a fit or an exact
 * step. Same zoom (usePatternZoom) as the reference tier's CanvasStrip zoom cluster (ZoomControls.vue): a `canvas`
 * pill instead of the strip's plain buttons.
 */
defineProps<{ zoomPercent: number }>()
const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  reset: []
}>()
const { t } = useI18n()
</script>

<template>
  <div class="zoom-pill" data-testid="zoom-pill">
    <IconButton icon="zoom-out" variant="plain" :icon-size="18" :label="t.canvas.zoomOutLabel" data-testid="zoom-pill-out" @click="emit('zoom-out')" />
    <IconButton icon="fit" variant="plain" :icon-size="18" :label="t.canvas.zoomResetLabel" data-testid="zoom-pill-fit" @click="emit('reset')" />
    <span class="zoom-pill__level" data-testid="zoom-pill-level" hidden>{{ zoomPercent }}%</span>
    <IconButton icon="zoom-in" variant="plain" :icon-size="18" :label="t.canvas.zoomInLabel" data-testid="zoom-pill-in" @click="emit('zoom-in')" />
  </div>
</template>

<style scoped>
.zoom-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  box-shadow: var(--elevation-1);
}

/* The card's own 36px, bigger than the reference tier's 30px zoom cluster buttons (control-height-plain). */
.zoom-pill :deep(.icon-btn--plain) {
  width: var(--zoom-pill-button);
  height: var(--zoom-pill-button);
}

.zoom-pill__level {
  min-width: var(--zoom-level-width);
  font: var(--type-meta);
  color: var(--body);
  text-align: center;
}

:root[data-theme='contrast'] .zoom-pill {
  border-width: 2px;
  box-shadow: none;
}
</style>
