<script setup lang="ts">
import { computed } from 'vue'
import { useBackgroundSwatches } from '../../composables/canvas/useBackgroundSwatches'
import type { Layer } from '../../domain/grid'
import type { Background } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import BackgroundColorPicker from '../palette/BackgroundColorPicker.vue'

// A layer's Background picker (ADR 0079, tickets 0666, 0670; CanvasBackground and LayerSettings cards), in its Layer
// settings. Five swatches in each theme and a Custom color, on the Background given; high contrast has one white canvas,
// so only a line saying so remains. It only asks.
const props = defineProps<{
  /** The layer's Background as it shows: its own, or the device's last pick where it has none. */
  background: Background
  layer: Layer
}>()

const emit = defineEmits<{
  pick: [background: Background]
}>()

const { t } = useI18n()
const backgrounds = useCanvasBackground()
const background = computed(() => props.background)
/** The layer's Background as the picker's model stores it (ticket 0683); a pick is asked for, not stored here. The tile
 * keeps the layer's own Custom color, else the last one taken on the device. */
const picker = useBackgroundSwatches({
  choice: computed(() => (typeof background.value === 'number' ? background.value : 'custom')),
  customColor: computed(() => (typeof background.value === 'string' ? background.value : backgrounds.customColor.value)),
  setChoice: (position) => emit('pick', position),
  setCustomColor: (hex) => emit('pick', hex),
})
/** Each layer's section: its radio group's name and its test ids. */
const ofLayer = computed(() =>
  props.layer === 'canvas'
    ? { label: t.value.canvas.canvasColor.label, section: 'canvas-section', picker: 'canvas-color-picker' }
    : { label: t.value.frame.background.label, section: 'frame-background-section', picker: 'frame-background-picker' },
)
</script>

<template>
  <div class="background-section" :data-testid="ofLayer.section">
    <BackgroundColorPicker
      v-if="picker.offered.value"
      :swatches="picker.swatches.value"
      :label="ofLayer.label"
      :selected-id="picker.selectedId.value"
      :custom-color="picker.customColor.value"
      :data-testid="ofLayer.picker"
      @select="picker.choose"
      @select-custom="picker.chooseCustom"
    />
    <p v-else class="background-section__white" data-testid="canvas-stays-white">{{ t.panels.project.whiteInContrast }}</p>
  </div>
</template>

<style scoped>
.background-section {
  --swatch-gap: var(--overlay-fill);
  padding: var(--space-4) var(--space-10);
}

.background-section__white {
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}
</style>
