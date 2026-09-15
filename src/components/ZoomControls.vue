<script setup lang="ts">
import { useI18n } from '../i18n/useI18n'

defineProps<{ zoomPercent: number }>()
const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  reset: []
}>()
const { t } = useI18n()
</script>

<template>
  <div class="zoom-controls" data-testid="zoom-controls">
    <button
      type="button"
      data-testid="zoom-out"
      :aria-label="t.canvas.zoomOutLabel"
      @click="emit('zoom-out')"
    >
      −
    </button>
    <span class="zoom-controls__level" data-testid="zoom-level">{{ zoomPercent }}%</span>
    <button
      type="button"
      data-testid="zoom-in"
      :aria-label="t.canvas.zoomInLabel"
      @click="emit('zoom-in')"
    >
      +
    </button>
    <button
      type="button"
      data-testid="zoom-reset"
      :aria-label="t.canvas.zoomResetLabel"
      @click="emit('reset')"
    >
      ⤢
    </button>
  </div>
</template>

<style scoped>
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-controls__level {
  min-width: 3.5em;
  text-align: center;
  font-weight: var(--font-weight-bold);
}
</style>
