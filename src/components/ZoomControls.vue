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
  <!--
    A horizontal row, + through reset left to right (ticket 35's ordering, kept by tickets 51/57's moves). Floats
    over the canvas panel (see App.vue, which pins this to the panel's top-right corner) rather than sitting in the
    above-canvas row, so it carries its own translucent background/border here — unlike a plain inline control, it
    has to stay legible with a painted Pattern running underneath it at any zoom level.
  -->
  <div class="zoom-controls" data-testid="zoom-controls">
    <button
      type="button"
      class="zoom-controls__button"
      data-testid="zoom-in"
      :title="t.canvas.zoomInLabel"
      :aria-label="t.canvas.zoomInLabel"
      @click="emit('zoom-in')"
    >
      +
    </button>
    <span class="zoom-controls__level" data-testid="zoom-level">{{ zoomPercent }}%</span>
    <button
      type="button"
      class="zoom-controls__button"
      data-testid="zoom-out"
      :title="t.canvas.zoomOutLabel"
      :aria-label="t.canvas.zoomOutLabel"
      @click="emit('zoom-out')"
    >
      −
    </button>
    <button
      type="button"
      class="zoom-controls__button"
      data-testid="zoom-reset"
      :title="t.canvas.zoomResetLabel"
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
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: color-mix(in srgb, var(--color-paper-solid) 80%, transparent);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.zoom-controls__button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  font-size: 20px;
  line-height: 1;
}

.zoom-controls__level {
  width: 40px;
  padding: 4px 0;
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  text-align: center;
}
</style>
