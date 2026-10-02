<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'

defineProps<{ zoomPercent: number }>()
const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  reset: []
}>()
const { t } = useI18n()
</script>

<template>
  <!--
    The canvas strip's zoom (ticket 143; CanvasStrip card): zoom out, the level, zoom in, then reset to fit. 30px icon
    buttons with no fill; the level in DM Mono, 48px wide and centered, so the buttons don't shift as it changes.
  -->
  <div class="zoom-controls" data-testid="zoom-controls">
    <IconButton
      icon="zoom-out"
      variant="plain"
      :icon-size="16"
      :label="t.canvas.zoomOutLabel"
      data-testid="zoom-out"
      @click="emit('zoom-out')"
    />
    <IconButton
      icon="fit"
      variant="plain"
      :icon-size="16"
      :label="t.canvas.zoomResetLabel"
      data-testid="zoom-reset"
      @click="emit('reset')"
    />
    <span class="zoom-controls__level" data-testid="zoom-level" hidden>{{ zoomPercent }}%</span>
    <IconButton
      icon="zoom-in"
      variant="plain"
      :icon-size="16"
      :label="t.canvas.zoomInLabel"
      data-testid="zoom-in"
      @click="emit('zoom-in')"
    />
  </div>
</template>

<style scoped>
.zoom-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.zoom-controls__level {
  width: var(--zoom-level-width);
  font: var(--type-meta);
  color: var(--ink);
  text-align: center;
}
</style>
