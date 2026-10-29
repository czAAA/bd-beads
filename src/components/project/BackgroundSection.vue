<script setup lang="ts">
import { computed } from 'vue'
import type { Layer } from '../../domain/grid'
import type { Background, Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import { canvasBackgrounds } from '../../rendering/canvasBackgrounds'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useResolvedTheme } from '../../theme/useResolvedTheme'
import BackgroundColorPicker from '../palette/BackgroundColorPicker.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// A layer's Background picker (ADR 0079, ticket 0666; CanvasBackground and ProjectPanel cards): the Project panel's
// Canvas section and the Frame panel's background section. Five swatches in each theme and a Custom color, on the
// layer's own Background; high contrast has one white canvas, so only a line saying so remains. It only asks.
const props = defineProps<{
  project: Project
  layer: Layer
}>()

const emit = defineEmits<{
  pick: [background: Background]
}>()

const { t } = useI18n()
const theme = useResolvedTheme()
const backgrounds = useCanvasBackground(() => props.project)
const shown = computed(() => backgrounds.shownOf(props.layer))

const swatches = computed(() => {
  const list = canvasBackgrounds(theme.value)
  return list.map(({ id, color }, index) => {
    const name = t.value.canvas.canvasColor.names[id]
    return { id, color, name, label: fillBlanks(t.value.canvas.canvasColor.swatchLabel, { name, n: index + 1, count: list.length }) }
  })
})
const selectedId = computed(() => (shown.value.choice === 'custom' ? undefined : swatches.value[shown.value.choice - 1]?.id))
/** The tile keeps the layer's own Custom color, else the last one taken on the device. */
const customColor = computed(() => (typeof shown.value.background === 'string' ? shown.value.background : backgrounds.customColor.value))
/** Each layer's section: its radio group's name and its test ids. */
const ofLayer = computed(() =>
  props.layer === 'canvas'
    ? { label: t.value.canvas.canvasColor.label, section: 'canvas-section', picker: 'canvas-color-picker' }
    : { label: t.value.frame.background.label, section: 'frame-background-section', picker: 'frame-background-picker' },
)

function choose(id: string) {
  emit('pick', swatches.value.findIndex((swatch) => swatch.id === id) + 1)
}
</script>

<template>
  <div class="background-section" :data-testid="ofLayer.section">
    <BackgroundColorPicker
      v-if="swatches.length"
      :swatches="swatches"
      :label="ofLayer.label"
      :selected-id="selectedId"
      :custom-color="customColor"
      :data-testid="ofLayer.picker"
      @select="choose"
      @select-custom="emit('pick', $event)"
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
