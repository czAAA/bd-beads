<script setup lang="ts">
import { computed } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import { canvasBackgrounds } from '../../rendering/canvasBackgrounds'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useResolvedTheme } from '../../theme/useResolvedTheme'
import BackgroundColorPicker from '../palette/BackgroundColorPicker.vue'
import PanelSection from '../shell/PanelSection.vue'

// The Frame panel's last section, margin (ticket 0656; MarginSheet and Frame cards): the margin color in the background
// color picker, Auto first (split, the Canvas color and the margin color), then the theme's five Canvas colors, the one
// that is the Canvas color dotted, then Custom color; and the line on what the margin is. High contrast keeps it white.
const { t } = useI18n()
const theme = useResolvedTheme()
const canvas = useCanvasBackground()
const margin = canvas.margin

const AUTO = 'auto'

const listed = computed(() => canvasBackgrounds(theme.value))
const swatches = computed(() => {
  const words = t.value.frame.margin
  const canvasColor = canvas.background.value?.color
  const auto = { id: AUTO, color: margin.auto.value, split: canvasColor, name: words.auto, label: words.autoLabel }
  return [
    auto,
    ...listed.value.map(({ id, color }, index) => {
      const name = t.value.canvas.canvasColor.names[id]
      const isCanvas = color === canvasColor
      const label = isCanvas
        ? fillBlanks(words.canvasColorLabel, { color: name })
        : fillBlanks(t.value.canvas.canvasColor.swatchLabel, { name, n: index + 1, count: listed.value.length })
      return { id, color, name, label, dot: isCanvas }
    }),
  ]
})

/** The swatch shown: Auto, one of the five, or none while the Custom color is. */
const selectedId = computed(() => {
  const choice = margin.choice.value
  if (choice === 'custom') return margin.customColor.value ? undefined : AUTO
  if (choice === 'auto') return AUTO
  return listed.value[choice - 1]?.id ?? AUTO
})
const summary = computed(() => {
  const id = selectedId.value
  if (id === undefined) return t.value.palette.customColorLabel
  return swatches.value.find((swatch) => swatch.id === id)?.name
})

function choose(id: string) {
  margin.setChoice(id === AUTO ? 'auto' : listed.value.findIndex((background) => background.id === id) + 1)
}
</script>

<template>
  <PanelSection id="frame:margin" :label="t.frame.margin.heading" :summary="listed.length ? summary : undefined" data-testid="margin-section">
    <div class="margin-section">
      <BackgroundColorPicker
        v-if="listed.length"
        :swatches="swatches"
        :label="t.frame.margin.colorLabel"
        :selected-id="selectedId"
        :custom-color="margin.customColor.value"
        data-testid="margin-color-picker"
        @select="choose"
        @select-custom="margin.setCustomColor"
      />
      <p class="margin-section__line" data-testid="margin-line">{{ t.frame.margin.line }}</p>
    </div>
  </PanelSection>
</template>

<style scoped>
.margin-section {
  --swatch-gap: var(--overlay-fill);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-10) var(--space-8);
}

.margin-section__line {
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
