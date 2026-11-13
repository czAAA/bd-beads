<script setup lang="ts">
import { computed, useId } from 'vue'
import { useConvertImageWizardState, type ConvertSizeUnit } from '../../composables/import/useConvertImageWizard'
import { useConvertSizeReadings } from '../../composables/import/useConvertSizeReadings'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import InfoButton from '../ui/InfoButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'
import ConvertSwitchRow from './ConvertSwitchRow.vue'

// The Size popover's body, from "More for the size" beside Width (ConvertImage card DS-1, ticket 0896; tickets 0747, 0757,
// 0780, 0894): "Size" with what Width and Height do behind an Info button, the units, Height, Keep the picture's shape
// (on, the side not moved follows the picture's shape), and the result box with how much picture one bead takes.
const { t } = useI18n()
const wizard = useConvertImageWizardState()
const readings = useConvertSizeReadings(wizard)
const result = readings.result
const words = computed(() => t.value.convertImage.wizard)
const unitLabelId = useId()

const unitOptions = computed(() => [
  { value: 'beads' as const, label: t.value.form.unitBeads },
  { value: 'mm' as const, label: t.value.form.unitMm },
])
const unit = computed({ get: () => wizard.sizeUnit.value, set: (next: ConvertSizeUnit) => wizard.setSizeUnit(next) })

const keepShape = computed({ get: () => wizard.linked.value, set: (next: boolean) => wizard.setLinked(next) })
const keepShapeInfo = computed(() => ({
  label: fillBlanks(words.value.whatDoes, { name: words.value.keepShape }),
  body: keepShape.value ? words.value.keepShapeOn : words.value.keepShapeOff,
}))

/** With a part of the beads kept, the result is its size and measure, then the whole it was kept from. */
const keptFrom = computed(() =>
  result.value?.kept ? fillBlanks(words.value.resultKeptFrom, { columns: wizard.dimensions.value.columns, rows: wizard.dimensions.value.rows }) : undefined,
)
const shown = computed(() => result.value?.kept ?? result.value)
</script>

<template>
  <div class="convert-size" data-testid="convert-size">
    <div class="convert-size__head">
      <span class="convert-size__title">
        {{ words.sizeTitle }}
        <InfoButton :label="words.whatSizeDoes" :body="words.widthHint" data-testid="convert-width-info" />
      </span>
      <span class="convert-size__units">
        <span :id="unitLabelId" class="convert-size__label">{{ words.units }}</span>
        <SegmentedControl v-model="unit" :options="unitOptions" mono small :labelledby="unitLabelId" data-testid="convert-size-unit" />
      </span>
    </div>

    <ValueSlider
      :label="t.form.heightLabel"
      :model-value="wizard.sizing.value.height"
      :min="wizard.sizing.value.heightRange.min"
      :max="wizard.sizing.value.heightRange.max"
      :value="readings.height.value.value"
      :secondary="readings.height.value.secondary"
      :valuetext="readings.height.value.valuetext"
      :min-label="readings.height.value.minLabel"
      :max-label="readings.height.value.maxLabel"
      :marks="readings.heightMarks.value"
      doubling
      testid="convert-height"
      @update:model-value="wizard.setHeight"
    />

    <ConvertSwitchRow v-model="keepShape" :label="words.keepShape" :info="keepShapeInfo" testid="convert-keep-shape" />

    <div v-if="shown" class="convert-size__result" data-testid="convert-size-result">
      <p class="convert-size__line">
        <span class="convert-size__grid">{{ shown.grid }}</span> · {{ shown.measured }}<template v-if="keptFrom"> · {{ keptFrom }}</template>
      </p>
      <p class="convert-size__ratio" data-testid="convert-size-ratio">{{ result?.ratio }}</p>
    </div>
  </div>
</template>

<style scoped>
.convert-size {
  display: flex;
  flex-direction: column;
  gap: var(--space-14);
}

.convert-size__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8) var(--space-12);
}

.convert-size__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  font: var(--type-control);
  font-weight: 600;
  color: var(--ink);
}

.convert-size__units {
  display: inline-flex;
  align-items: center;
  gap: var(--space-8);
}

.convert-size__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-size__result {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-10) var(--space-12);
  background: var(--surface);
  border-radius: var(--radius-lg);
}

:root[data-theme='contrast'] .convert-size__result {
  border: 2px solid var(--line);
}

.convert-size__line {
  margin: 0;
  font: var(--type-meta);
  color: var(--body);
}

.convert-size__grid {
  font-weight: 500;
  color: var(--ink);
}

.convert-size__ratio {
  margin: 0;
  font: var(--type-small);
  color: var(--muted);
}
</style>
