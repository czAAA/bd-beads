<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import type { CanvasBackground } from '../../rendering/canvasBackgrounds'

// A layer's Background in a folded section's summary (ProjectPanel card, ticket 0666): a 12px chip of its color and its
// name, or "Custom color".
const props = defineProps<{
  background: CanvasBackground
}>()

const { t } = useI18n()
const name = computed(() => (props.background.id === 'custom' ? t.value.palette.customColorLabel : t.value.canvas.canvasColor.names[props.background.id]))
</script>

<template>
  <span class="background-chip" :style="{ backgroundColor: background.color }" aria-hidden="true" />{{ name }}
</template>

<style scoped>
.background-chip {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: var(--space-6);
  vertical-align: -1px;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}
</style>
