<script setup lang="ts">
import { computed, useId } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { LEAST_COLOR_BEADS_SHIFT_STEP, MOST_LEAST_COLOR_BEADS, NO_LEAST_COLOR_BEADS } from '../../domain/convertColors'
import { CLEAN_UP_STRENGTHS, type CleanUpStrength } from '../../domain/strayBeads'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import InfoButton from '../ui/InfoButton.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'

// The Clean up popover's body (ConvertImage card DS-3, ticket 0906): Clean up stray beads with its strength and the
// live count, then Small colors join's number and what it joined. No Undo: each control shows its state.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard.cleanUp)
const cleanUp = wizard.cleanUp
const switchId = useId()
const strengthId = useId()
const smallId = useId()

const on = computed({ get: () => cleanUp.on.value, set: (next: boolean) => cleanUp.setOn(next) })
const strength = computed({ get: () => cleanUp.strength.value, set: (next: CleanUpStrength) => cleanUp.setStrength(next) })
const least = computed({ get: () => cleanUp.leastBeads.value, set: (next: number) => cleanUp.setLeastBeads(next) })

/** The three steps; while the switch is off each says why it is off. */
const steps = computed(() =>
  CLEAN_UP_STRENGTHS.map((value) => {
    const label = words.value[value]
    return { value, label, ...(on.value ? {} : { tooltip: { name: label, disabledBody: words.value.turnOnFirst } }) }
  }),
)

/** The count under the steps: what was cleaned, what is left, or what flat art keeps. */
const count = computed(() => {
  if (on.value) return cleanUp.cleaned.value > 0 ? plural(locale.value, cleanUp.cleaned.value, words.value.cleaned) : words.value.none
  return plural(locale.value, cleanUp.lone.value, cleanUp.flatArt.value ? words.value.singleKept : words.value.left)
})

const joinedLine = computed(() => {
  const { colors, beads } = cleanUp.joined.value
  if (colors === 0) return words.value.everyColorStays
  return `${plural(locale.value, colors, words.value.colorsJoined)} · ${plural(locale.value, beads, words.value.joinedBeads)}`
})
</script>

<template>
  <div class="convert-clean-up" data-testid="convert-clean-up">
    <span class="convert-clean-up__title">
      {{ words.title }}
      <InfoButton :label="words.whatDoes" :body="words.whatDoesBody" data-testid="convert-clean-up-info" />
    </span>

    <p v-if="cleanUp.flatArt.value" class="convert-clean-up__pixel-art" role="status" data-testid="convert-clean-up-pixel-art">
      <AppIcon name="image" :size="16" />
      <span>{{ words.pixelArtLine }}</span>
    </p>

    <div class="convert-clean-up__box">
      <div class="convert-clean-up__switch">
        <span :id="switchId" class="convert-clean-up__name">{{ words.strayBeads }}</span>
        <AppSwitch v-model="on" :label="words.strayBeads" :aria-labelledby="switchId" data-testid="convert-clean-up-switch" />
      </div>
      <div class="convert-clean-up__strength">
        <span :id="strengthId" class="convert-clean-up__label" :class="{ 'convert-clean-up__label--off': !on }">{{ words.strength }}</span>
        <SegmentedControl v-model="strength" class="convert-clean-up__steps" :options="steps" :labelledby="strengthId" :disabled="!on" small data-testid="convert-clean-up-strength" />
      </div>
      <p class="convert-clean-up__count" :class="{ 'convert-clean-up__count--off': !on }" role="status" data-testid="convert-clean-up-count">
        <span v-if="on" class="convert-clean-up__ring" aria-hidden="true" />
        <span>{{ count }}</span>
      </p>
    </div>

    <div class="convert-clean-up__small">
      <div class="convert-clean-up__small-row">
        <span class="convert-clean-up__name">
          <span :id="smallId">{{ words.smallColors }}</span>
          <InfoButton :label="words.smallColorsWhat" :body="words.smallColorsBody" data-testid="convert-small-colors-info" />
        </span>
        <span class="convert-clean-up__stepper" role="group" :aria-label="words.leastBeads">
          <span class="convert-clean-up__under">{{ words.under }}</span>
          <AppStepper
            v-model="least"
            :min="NO_LEAST_COLOR_BEADS"
            :max="MOST_LEAST_COLOR_BEADS"
            :shift-step-by="LEAST_COLOR_BEADS_SHIFT_STEP"
            :display="least === NO_LEAST_COLOR_BEADS ? words.stepOff : undefined"
            :decrease-label="words.fewer"
            :increase-label="words.more"
            :value-label="words.leastBeads"
            decrease-testid="convert-small-colors-fewer"
            increase-testid="convert-small-colors-more"
            value-testid="convert-small-colors-value"
          />
        </span>
      </div>
      <p class="convert-clean-up__joined" role="status" data-testid="convert-small-colors-joined">{{ joinedLine }}</p>
    </div>
  </div>
</template>

<style scoped>
.convert-clean-up {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.convert-clean-up__title,
.convert-clean-up__name {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  font: var(--type-control);
  color: var(--ink);
}

.convert-clean-up__title {
  font-weight: 600;
}

.convert-clean-up__pixel-art {
  display: flex;
  align-items: flex-start;
  gap: var(--space-8);
  margin: 0;
  font: var(--type-meta);
  color: var(--body);
}

.convert-clean-up__pixel-art > :first-child {
  flex: none;
  color: var(--muted);
}

.convert-clean-up__box {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
  padding: var(--space-10) var(--space-12) var(--space-12);
  background: var(--surface);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
}

.convert-clean-up__switch,
.convert-clean-up__small-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}

.convert-clean-up__strength {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.convert-clean-up__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-clean-up__label--off {
  color: var(--faint);
}

/* The three steps across the box, each a third, on `canvas`; the chosen one on `line` while off (DS-3). */
.convert-clean-up__steps {
  flex-wrap: nowrap;
  background: var(--canvas);
  border-color: var(--line);
}

.convert-clean-up__steps :deep(.segmented__tip),
.convert-clean-up__steps :deep(.segmented__option) {
  flex: 1 1 0;
  min-width: 0;
}

.convert-clean-up__steps :deep(.segmented__option) {
  padding-inline: var(--space-4);
}

.convert-clean-up__steps :deep(.segmented__option[aria-disabled='true'][aria-checked='true']) {
  color: var(--faint);
  background: var(--line);
}

.convert-clean-up__count {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0;
  font: var(--type-meta);
  color: var(--ink);
}

.convert-clean-up__count--off {
  color: var(--body);
}

/* The swatch of the preview's ring round each changed bead. */
.convert-clean-up__ring {
  flex: none;
  box-sizing: border-box;
  width: var(--space-14);
  height: calc(var(--space-14) + var(--space-4));
  border: var(--convert-cleaned-ring) solid var(--marker);
  border-radius: var(--radius-sm);
}

.convert-clean-up__small {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 0 var(--space-2);
}

.convert-clean-up__small-row {
  min-height: var(--control-height);
}

.convert-clean-up__small-row > .convert-clean-up__name {
  flex: 1 1 auto;
  flex-wrap: wrap;
}

.convert-clean-up__stepper {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-6);
}

.convert-clean-up__under {
  font: var(--type-meta);
  color: var(--muted);
}

.convert-clean-up__stepper :deep(.stepper) {
  height: var(--control-height);
  border-color: var(--button-line);
}

.convert-clean-up__stepper :deep(.stepper__button) {
  width: var(--control-height);
}

.convert-clean-up__stepper :deep(.stepper__value) {
  min-width: var(--space-32);
  font: var(--type-meta);
}

.convert-clean-up__joined {
  margin: 0;
  font: var(--type-meta);
  color: var(--body);
}
</style>
