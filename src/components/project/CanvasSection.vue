<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { canvasBackgrounds } from '../../rendering/canvasBackgrounds'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useResolvedTheme } from '../../theme/useResolvedTheme'
import BackgroundColorPicker from '../palette/BackgroundColorPicker.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// The body of the Project panel's canvas section (ProjectPanel and CanvasBackground cards, tickets 252, 348, 443, 554,
// 0653): the background color picker on the stored Canvas color, five swatches in each theme and a Custom color. High
// contrast has one white canvas, so only a line saying so remains.
const { t } = useI18n()
const theme = useResolvedTheme()
const canvas = useCanvasBackground()

const swatches = computed(() => {
  const list = canvasBackgrounds(theme.value)
  return list.map(({ id, color }, index) => {
    const name = t.value.canvas.canvasColor.names[id]
    return { id, color, name, label: fillBlanks(t.value.canvas.canvasColor.swatchLabel, { name, n: index + 1, count: list.length }) }
  })
})
const selectedId = computed(() => (canvas.shown.value === 'custom' ? undefined : swatches.value[canvas.shown.value - 1]?.id))

function choose(id: string) {
  canvas.setChoice(swatches.value.findIndex((swatch) => swatch.id === id) + 1)
}
</script>

<template>
  <div class="canvas-section" data-testid="canvas-section">
    <BackgroundColorPicker
      v-if="swatches.length"
      :swatches="swatches"
      :label="t.canvas.canvasColor.label"
      :selected-id="selectedId"
      :custom-color="canvas.customColor.value"
      data-testid="canvas-color-picker"
      @select="choose"
      @select-custom="canvas.setCustomColor"
    />
    <p v-else class="canvas-section__white" data-testid="canvas-stays-white">{{ t.panels.project.whiteInContrast }}</p>
  </div>
</template>

<style scoped>
.canvas-section {
  --swatch-gap: var(--overlay-fill);
  padding: var(--space-4) var(--space-10);
}

.canvas-section__white {
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}
</style>
