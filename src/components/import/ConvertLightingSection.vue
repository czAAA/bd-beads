<script setup lang="ts">
import { computed } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { fillBlanks } from '../../domain/fillBlanks'
import { LIGHTING_SLIDER_LEAST, LIGHTING_SLIDER_MOST, LIGHTING_SLIDERS, type LightingSlider } from '../../domain/lightingFix'
import { signedValue } from '../../domain/formatNumber'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'
import InfoButton from '../ui/InfoButton.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'

// The Lighting popover's body (ConvertImage card DS-3, ticket 0908): "Lighting" with its (i), then Brightness, Contrast
// and Saturation, each from a middle that changes nothing, with its value and its own reset. No Undo: each shows its
// value and puts itself back.
const { t } = useI18n()
const { lighting } = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard.lighting)
/** Shift and an arrow, and Page Up and Page Down, move a slider by 10 (DS-3). */
const SHIFT_STEP = 10
const MIDDLE = [{ value: 0 }]

const sliders = computed(() =>
  LIGHTING_SLIDERS.map((name: LightingSlider) => {
    const value = lighting.sliders.value[name]
    const [less, more] = words.value.ends[name]
    return { name, value, label: words.value[name], shown: signedValue(value), less, more, reset: fillBlanks(words.value.reset, { slider: words.value[name] }) }
  }),
)
</script>

<template>
  <div class="convert-lighting-sliders" data-testid="convert-lighting-sliders">
    <span class="convert-lighting-sliders__title">
      {{ words.title }}
      <InfoButton :label="words.whatDoes" :body="words.whatDoesBody" data-testid="convert-lighting-info" />
    </span>
    <ValueSlider
      v-for="slider in sliders"
      :key="slider.name"
      class="convert-lighting-sliders__slider"
      :label="slider.label"
      :model-value="slider.value"
      :min="LIGHTING_SLIDER_LEAST"
      :max="LIGHTING_SLIDER_MOST"
      :origin="0"
      :shift-step="SHIFT_STEP"
      :marks="MIDDLE"
      :value="slider.shown"
      :valuetext="slider.shown"
      :min-label="slider.less"
      :max-label="slider.more"
      :testid="`convert-lighting-${slider.name}`"
      @update:model-value="lighting.setSlider(slider.name, $event)"
    >
      <template #action>
        <IconButton
          icon="reset"
          :icon-size="16"
          variant="plain"
          class="convert-lighting-sliders__reset"
          :label="slider.reset"
          :tooltip="true"
          :disabled="slider.value === 0"
          :disabled-body="words.atZero"
          :data-testid="`convert-lighting-${slider.name}-reset`"
          @click="lighting.resetSlider(slider.name)"
        />
      </template>
    </ValueSlider>
  </div>
</template>

<style scoped>
.convert-lighting-sliders {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
}

.convert-lighting-sliders__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  font: var(--type-control);
  font-weight: 600;
  color: var(--ink);
}

/* The head at least 28 tall: the name, the value and 4 after it the reset (DS-3). */
.convert-lighting-sliders__slider :deep(.vs-head) {
  gap: var(--space-4);
  min-height: var(--control-height-small);
}

/* The track 40 tall (DS-3). */
.convert-lighting-sliders__slider :deep(.vs-range) {
  height: var(--convert-lighting-track-height);
}

/* The ends are words: each takes half the track and wraps, both in `muted`. */
.convert-lighting-sliders__slider :deep(.vs-ends) {
  gap: var(--space-8);
  white-space: normal;
}

.convert-lighting-sliders__slider :deep(.vs-min),
.convert-lighting-sliders__slider :deep(.vs-max) {
  max-width: 50%;
  color: var(--muted);
}

.convert-lighting-sliders__slider :deep(.vs-max) {
  text-align: right;
}

/* The reset, 28 square: `ink` once moved, `faint` at 0. */
.convert-lighting-sliders :deep(.convert-lighting-sliders__reset) {
  width: var(--control-height-small);
  height: var(--control-height-small);
  color: var(--ink);
}

.convert-lighting-sliders :deep(.convert-lighting-sliders__reset[aria-disabled='true']) {
  color: var(--faint);
}
</style>
