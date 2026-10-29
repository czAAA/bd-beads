<script setup lang="ts">
import { useBackgroundSwatches } from '../../composables/canvas/useBackgroundSwatches'
import { useI18n } from '../../i18n/useI18n'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import BackgroundColorPicker from '../palette/BackgroundColorPicker.vue'

// The body of the Project panel's canvas section (ProjectPanel and CanvasBackground cards, tickets 252, 348, 443, 554,
// 0653): the background color picker on the stored Canvas color, five swatches in each theme and a Custom color. High
// contrast has one white canvas, so only a line saying so remains.
const { t } = useI18n()
const picker = useBackgroundSwatches(useCanvasBackground())
</script>

<template>
  <div class="canvas-section" data-testid="canvas-section">
    <BackgroundColorPicker
      v-if="picker.offered.value"
      :swatches="picker.swatches.value"
      :label="t.canvas.canvasColor.label"
      :selected-id="picker.selectedId.value"
      :custom-color="picker.customColor.value"
      data-testid="canvas-color-picker"
      @select="picker.choose"
      @select-custom="picker.chooseCustom"
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
