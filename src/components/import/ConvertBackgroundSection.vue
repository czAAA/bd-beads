<script setup lang="ts">
import { computed } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { BACKGROUND_TOLERANCE } from '../../domain/convertBackground'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'
import ConvertSwitchRow from './ConvertSwitchRow.vue'

// Convert image's Background step (ConvertImage card, 2 Background; ticket 0780): the Remove background switch, then two
// stages. 1 Find hatches what the edges inward take on the preview, with Tolerance to widen or narrow it; nothing goes until
// Remove what was found. 2 Remove makes them empty places, and Show what was found goes back.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)

const on = computed({ get: () => wizard.background.value !== 'off', set: (next: boolean) => wizard.setRemoveBackground(next) })
const found = computed(() => wizard.backgroundFound.value)
const stage = computed(() => wizard.background.value)
/** The found line round its share, which is set in bold: the words before the blank and after it. */
const foundLine = computed(() => {
  const [before = '', after = ''] = words.value.foundLine.split('{n}')
  return { before, after }
})
</script>

<template>
  <div class="convert-background" data-testid="convert-background">
    <ConvertSwitchRow
      v-model="on"
      :label="words.removeBackground"
      :line="on ? words.removeBackgroundOn : words.removeBackgroundOff"
      testid="convert-remove-background"
    />

    <template v-if="on">
      <ol class="convert-background__stages" :aria-label="words.stagesLabel" data-testid="convert-background-stages">
        <li class="convert-background__stage" :class="stage === 'find' ? 'is-current' : 'is-done'" :aria-current="stage === 'find' ? 'step' : undefined">
          <b aria-hidden="true">1</b>{{ words.stageFind }}
        </li>
        <li class="convert-background__stage" :class="{ 'is-current': stage === 'removed' }" :aria-current="stage === 'removed' ? 'step' : undefined">
          <b aria-hidden="true">2</b>{{ words.stageRemove }}
        </li>
      </ol>

      <template v-if="stage === 'find'">
        <p class="convert-background__legend" role="status" data-testid="convert-background-found">
          <span class="convert-background__hatch" aria-hidden="true" />
          <span>{{ foundLine.before }}<b>{{ found?.percent ?? 0 }}</b>{{ foundLine.after }}</span>
        </p>
        <ValueSlider
          :label="words.tolerance"
          :model-value="wizard.tolerance.value"
          :min="BACKGROUND_TOLERANCE.min"
          :max="BACKGROUND_TOLERANCE.max"
          :value="String(wizard.tolerance.value)"
          :valuetext="String(wizard.tolerance.value)"
          :min-label="words.toleranceMin"
          :max-label="words.toleranceMax"
          testid="convert-tolerance"
          @update:model-value="wizard.setTolerance"
        />
        <div>
          <AppButton variant="primary" data-testid="convert-remove-found" @click="wizard.removeFound">{{ words.removeFound }}</AppButton>
        </div>
      </template>

      <template v-else>
        <div class="convert-background__done" data-testid="convert-background-removed">
          <AppIcon name="check" :size="16" />
          <div>
            <span class="convert-background__done-title">{{ words.removed }}</span>
            <p class="convert-background__done-line">{{ plural(locale, found?.beads ?? 0, words.removedLine) }}</p>
          </div>
        </div>
        <div>
          <AppButton size="sm" data-testid="convert-show-found" @click="wizard.showFound">{{ words.showFound }}</AppButton>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.convert-background {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.convert-background__stages {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}

.convert-background__stage {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  height: var(--convert-stage-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
}

.convert-background__stage > b {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: var(--convert-stage-disc);
  height: var(--convert-stage-disc);
  font: var(--type-meta-tiny);
  border: 1px solid var(--line-strong);
  border-radius: 50%;
}

.convert-background__stage.is-current {
  color: var(--ink);
  background: var(--elevated);
  border-color: var(--ink);
}

.convert-background__stage.is-current > b,
.convert-background__stage.is-done > b {
  color: var(--canvas);
  background: var(--ink);
  border-color: var(--ink);
}

.convert-background__legend {
  display: flex;
  align-items: flex-start;
  gap: var(--space-10);
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}

.convert-background__hatch {
  flex: none;
  box-sizing: border-box;
  width: var(--step-disc);
  height: var(--step-disc);
  background: var(--found-hatch);
  border: 1px solid var(--marker);
  border-radius: var(--radius-xs);
}

.convert-background__done {
  display: flex;
  align-items: flex-start;
  gap: var(--space-10);
  padding: var(--space-10) var(--space-12);
  background: var(--surface);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
}

.convert-background__done-title {
  font: var(--type-control);
  color: var(--ink);
}

.convert-background__done-line {
  margin: 0;
  font: var(--type-small);
  color: var(--muted);
}
</style>
