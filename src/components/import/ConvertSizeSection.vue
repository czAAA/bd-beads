<script setup lang="ts">
import { computed, useId } from 'vue'
import { useConvertImageWizardState, type ConvertSizeUnit } from '../../composables/import/useConvertImageWizard'
import { useConvertResult } from '../../composables/import/useConvertResult'
import { LARGE_SCHEMA_BEADS } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'

// Convert image's Size section (ConvertImage card, 3 Size; ticket 0747): slide in (beads or mm), one Width slider with
// its marks, the result line, the line under it while a part is woven, and the Large Schema note. The height follows
// the picture through the wizard's one sizing rule; nothing here sets it.
const { t } = useI18n()
const wizard = useConvertImageWizardState()
const result = useConvertResult(wizard)
const words = computed(() => t.value.convertImage.wizard)
const unitLabelId = useId()

const unitOptions = computed(() => [
  { value: 'beads' as const, label: t.value.form.unitBeads },
  { value: 'mm' as const, label: t.value.form.unitMm },
])
const unit = computed({ get: () => wizard.sizeUnit.value, set: (next: ConvertSizeUnit) => wizard.setSizeUnit(next) })

const sizing = computed(() => wizard.sizing.value)
const inBeads = (beads: number) => fillBlanks(words.value.widthBeads, { n: beads })
const inMm = (beads: number) => fillBlanks(words.value.widthMm, { n: wizard.widthMmOf(beads) })
/** The head's value in the chosen unit first, the other after it (ValueSlider card). */
const value = computed(() => (unit.value === 'beads' ? inBeads(sizing.value.width) : inMm(sizing.value.width)))
const secondary = computed(() => (unit.value === 'beads' ? inMm(sizing.value.width) : inBeads(sizing.value.width)))
const valuetext = computed(() => [value.value, secondary.value, ...(sizing.value.mark && result.value ? [result.value.ratio] : [])].join(', '))
const minLabel = computed(() => (unit.value === 'beads' ? String(sizing.value.range.min) : String(wizard.widthMmOf(sizing.value.range.min))))
const maxLabel = computed(() => fillBlanks(words.value.widthMaxLabel, { value: unit.value === 'beads' ? inBeads(sizing.value.range.max) : inMm(sizing.value.range.max) }))

/** The marks with the width they stand for in the chosen unit ("8 beads", "40 mm"); the one at an end has the end's label only. */
const marks = computed(() =>
  sizing.value.marks.map((mark) => ({
    value: mark.width,
    label:
      mark.width === sizing.value.range.min || mark.width === sizing.value.range.max
        ? undefined
        : unit.value === 'beads' ? inBeads(mark.width) : inMm(mark.width),
  })),
)
</script>

<template>
  <div class="convert-size" data-testid="convert-size">
    <div class="convert-size__row">
      <span :id="unitLabelId" class="convert-size__label">{{ words.slideIn }}</span>
      <SegmentedControl v-model="unit" :options="unitOptions" mono small :labelledby="unitLabelId" data-testid="convert-size-unit" />
    </div>

    <ValueSlider
      :label="t.form.widthLabel"
      :model-value="sizing.width"
      :min="sizing.range.min"
      :max="sizing.range.max"
      :value="value"
      :secondary="secondary"
      :valuetext="valuetext"
      :min-label="minLabel"
      :max-label="maxLabel"
      :marks="marks"
      :hint="words.widthHint"
      testid="convert-width"
      @update:model-value="wizard.setWidth"
    />

    <div v-if="result" class="convert-size__result" data-testid="convert-result">
      <span class="convert-size__label">{{ words.result }}</span>
      <p class="convert-size__line" role="status">
        <span class="convert-size__grid">{{ result.grid }}</span> · {{ result.measured }}
      </p>
      <p class="convert-size__ratio" data-testid="convert-ratio">{{ result.ratio }}</p>
    </div>
    <p v-if="wizard.weave.value === 'part'" class="convert-size__hint" data-testid="convert-part-follows">{{ words.partFollows }}</p>

    <AppNote v-if="wizard.largeSchema.value" data-testid="convert-large-schema">{{ fillBlanks(words.largeSchema, { beads: LARGE_SCHEMA_BEADS }) }}</AppNote>
  </div>
</template>

<style scoped>
.convert-size {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.convert-size__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  min-height: var(--panel-row);
}

.convert-size__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-size__hint {
  margin: 0;
  font: var(--type-small);
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

:root[data-theme='dark'] .convert-size__result {
  background: var(--elevated);
}

:root[data-theme='contrast'] .convert-size__result {
  border: 2px solid var(--line);
}

.convert-size__line {
  margin: 0;
  font: var(--type-meta);
  color: var(--body);
}

.convert-size__ratio {
  margin: 0;
  font: var(--type-small);
  color: var(--muted);
}

.convert-size__grid {
  font-weight: 500;
  color: var(--ink);
}
</style>
