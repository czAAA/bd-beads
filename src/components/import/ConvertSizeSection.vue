<script setup lang="ts">
import { computed, useId } from 'vue'
import { useConvertImageWizardState, type ConvertSizeUnit } from '../../composables/import/useConvertImageWizard'
import { useConvertResult } from '../../composables/import/useConvertResult'
import { controlAction } from '../../composables/shell/controlRegistry'
import { LARGE_SCHEMA_BEADS } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppNote from '../ui/AppNote.vue'
import IconButton from '../ui/IconButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'

// Convert image's Size section (ConvertImage card, 3 Size; tickets 0747, 0757, 0770): slide in, the Width and Height
// sliders with their marks (the Suggested Width's among them) and the chain, the result line with Use suggested, the part
// line and the Large Schema note. Linked, the side not moved follows the picture through the wizard's one sizing rule.
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
const inMm = (mm: number) => fillBlanks(words.value.widthMm, { n: mm })

/** One slider's readings in the chosen unit (ValueSlider card): the head's value, the other unit after it, the ends. */
function readings(beads: number, range: { min: number; max: number }, mmOf: (beads: number) => number, maxWords: string, extra?: string) {
  const inUnit = (at: number) => (unit.value === 'beads' ? inBeads(at) : inMm(mmOf(at)))
  const other = (at: number) => (unit.value === 'beads' ? inMm(mmOf(at)) : inBeads(at))
  return {
    value: inUnit(beads),
    secondary: other(beads),
    valuetext: [inUnit(beads), other(beads), ...(sizing.value.mark && result.value ? [result.value.ratio] : []), ...(extra ? [extra] : [])].join(', '),
    minLabel: unit.value === 'beads' ? String(range.min) : String(mmOf(range.min)),
    maxLabel: fillBlanks(maxWords, { value: unit.value === 'beads' ? inBeads(range.max) : inMm(mmOf(range.max)) }),
  }
}
/** The Suggested Width (ticket 0770): worked out only here, as the Size step shows. */
const suggested = computed(() => wizard.suggestedWidth.value)
const onSuggested = computed(() => suggested.value === sizing.value.width)
const widthReadings = computed(() =>
  readings(sizing.value.width, sizing.value.range, wizard.widthMmOf, words.value.widthMaxLabel, onSuggested.value ? words.value.suggested : undefined),
)
const heightReadings = computed(() => readings(sizing.value.height, sizing.value.heightRange, wizard.heightMmOf, words.value.maxLabel))

/** The marks with the size they stand for in the chosen unit ("8 beads", "40 mm"); the one at an end has the end's label only. */
function markList(list: readonly { at: number }[], range: { min: number; max: number }, mmOf: (beads: number) => number) {
  return list.map((mark) => ({
    value: mark.at,
    label:
      mark.at === range.min || mark.at === range.max
        ? undefined
        : unit.value === 'beads' ? inBeads(mark.at) : inMm(mmOf(mark.at)),
  }))
}
/** The Width marks, the Suggested Width's featured and labelled "suggested", on a mark or between them (ticket 0770). */
const widthMarks = computed(() => {
  const marks = markList(sizing.value.marks.map((mark) => ({ at: mark.width })), sizing.value.range, wizard.widthMmOf)
  const at = suggested.value
  if (at === undefined) return marks
  const featured = { value: at, label: words.value.suggested, featured: true }
  return [...marks.filter((mark) => mark.value !== at), featured].sort((a, b) => a.value - b.value)
})
const useSuggestedBody = computed(() =>
  suggested.value === undefined ? '' : fillBlanks(t.value.tooltips.useSuggested, { width: unit.value === 'beads' ? inBeads(suggested.value) : inMm(wizard.widthMmOf(suggested.value)) }),
)
const heightMarks = computed(() => markList(sizing.value.heightMarks.map((mark) => ({ at: mark.height })), sizing.value.heightRange, wizard.heightMmOf))

const chain = computed(() => controlAction(wizard.linked.value ? 'size-linked' : 'size-unlinked'))
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
      :value="widthReadings.value"
      :secondary="widthReadings.secondary"
      :valuetext="widthReadings.valuetext"
      :min-label="widthReadings.minLabel"
      :max-label="widthReadings.maxLabel"
      :marks="widthMarks"
      :hint="words.widthHint"
      testid="convert-width"
      @update:model-value="wizard.setWidth"
    />

    <div class="convert-size__chain">
      <IconButton :action="chain" :icon-size="16" data-testid="convert-size-chain" :data-linked="wizard.linked.value" @click="wizard.setLinked(!wizard.linked.value)" />
    </div>

    <ValueSlider
      :label="t.form.heightLabel"
      :model-value="sizing.height"
      :min="sizing.heightRange.min"
      :max="sizing.heightRange.max"
      :value="heightReadings.value"
      :secondary="heightReadings.secondary"
      :valuetext="heightReadings.valuetext"
      :min-label="heightReadings.minLabel"
      :max-label="heightReadings.maxLabel"
      :marks="heightMarks"
      testid="convert-height"
      @update:model-value="wizard.setHeight"
    />

    <div v-if="result" class="convert-size__result" data-testid="convert-result">
      <div class="convert-size__result-head">
        <span class="convert-size__label">{{ words.result }}</span>
        <AppButton
          v-if="suggested !== undefined && !onSuggested"
          variant="link"
          :label="words.useSuggested"
          :tooltip="useSuggestedBody"
          data-testid="convert-use-suggested"
          @click="wizard.useSuggestedWidth()"
        >{{ words.useSuggested }}</AppButton>
      </div>
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

.convert-size__chain {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.convert-size__chain::before,
.convert-size__chain::after {
  flex: 1;
  height: 1px;
  content: '';
  background: var(--line);
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

.convert-size__result-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-8);
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
