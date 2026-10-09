<script setup lang="ts">
import { MAX_ZOOM_PERCENT, MIN_ZOOM_PERCENT } from '../../domain/grid'
import { useI18n } from '../../i18n/useI18n'
import { controlAction } from '../../composables/shell/controlRegistry'
import IconButton from '../ui/IconButton.vue'

const props = withDefaults(defineProps<{ zoomPercent: number; minPercent?: number; maxPercent?: number }>(), {
  minPercent: MIN_ZOOM_PERCENT,
  maxPercent: MAX_ZOOM_PERCENT,
})
const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  reset: []
}>()
const { t } = useI18n()
const zoomOut = controlAction('zoom-out')
const zoomIn = controlAction('zoom-in')
const zoomFit = controlAction('zoom-fit')
</script>

<template>
  <!--
    The canvas strip's zoom (ticket 143; CanvasStrip card): zoom out, the level, zoom in, then reset to fit (ticket 287 brought the level back). 30px icon
    buttons with no fill; the level in DM Mono, 48px wide and centered, so the buttons don't shift as it changes.
  -->
  <div class="zoom-controls" data-testid="zoom-controls">
    <IconButton variant="plain" :icon-size="16" :action="zoomOut" :disabled="props.zoomPercent <= props.minPercent" :disabled-body="t.tooltips.zoomOutLimit" data-testid="zoom-out" @click="emit('zoom-out')" />
    <span class="zoom-controls__level" data-testid="zoom-level">{{ zoomPercent }}%</span>
    <IconButton variant="plain" :icon-size="16" :action="zoomIn" :disabled="props.zoomPercent >= props.maxPercent" :disabled-body="t.tooltips.zoomInLimit" data-testid="zoom-in" @click="emit('zoom-in')" />
    <IconButton variant="plain" :icon-size="16" :action="zoomFit" data-testid="zoom-reset" @click="emit('reset')" />
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
