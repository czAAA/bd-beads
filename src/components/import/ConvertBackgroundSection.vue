<script setup lang="ts">
import { computed, useId } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { controlAction } from '../../composables/shell/controlRegistry'
import { BACKGROUND_TOLERANCE } from '../../domain/convertBackground'
import { fillBlanks } from '../../domain/fillBlanks'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import IconButton from '../ui/IconButton.vue'
import InfoButton from '../ui/InfoButton.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'

// The Background popover's body (ConvertImage card DS-1, ticket 0896; tickets 0780, 0787): the Remove background switch,
// the stage in hand as a plain numbered line, then 1 Find (what was found, Tolerance) or 2 Remove (what is left out), the
// tool line, and the actions: Undo and Redo of the background decisions, Start over, and the step to the other stage.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const labelId = useId()
const undo = controlAction('convert-undo')
const redo = controlAction('convert-redo')

const on = computed({ get: () => wizard.background.value !== 'off', set: (next: boolean) => wizard.setRemoveBackground(next) })
const found = computed(() => wizard.backgroundFound.value)
const stage = computed(() => wizard.background.value)
</script>

<template>
  <div class="convert-background" data-testid="convert-background">
    <div class="convert-background__head">
      <span class="convert-background__title">
        <span :id="labelId">{{ words.removeBackground }}</span>
        <InfoButton :label="fillBlanks(words.whatDoes, { name: words.removeBackground })" :body="words.removeBackgroundOff" data-testid="convert-remove-background-info" />
      </span>
      <AppSwitch v-model="on" :label="words.removeBackground" :aria-labelledby="labelId" data-testid="convert-remove-background" />
    </div>

    <template v-if="on">
      <p class="convert-background__stage" role="status" data-testid="convert-background-stages">{{ stage === 'find' ? words.stageFind : words.stageRemove }}</p>

      <template v-if="stage === 'find'">
        <p class="convert-background__found" role="status" data-testid="convert-background-found">
          <span class="convert-background__hatch" aria-hidden="true" />
          <span>{{ fillBlanks(words.foundLine, { n: found?.percent ?? 0 }) }}</span>
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
          :info="{ label: words.toleranceInfoLabel, body: words.toleranceInfo }"
          testid="convert-tolerance"
          @update:model-value="wizard.setTolerance"
        />
      </template>

      <div v-else class="convert-background__done" data-testid="convert-background-removed">
        <AppIcon name="check" :size="16" />
        <div>
          <span class="convert-background__done-title">{{ words.removed }}</span>
          <p class="convert-background__done-line">{{ plural(locale, found?.beads ?? 0, words.removedLine) }}</p>
        </div>
      </div>
    </template>

    <p class="convert-background__tool" data-testid="convert-background-tool-line">
      <AppIcon name="erase" :size="16" />
      <span>{{ words.bandBackground }}</span>
    </p>

    <div class="convert-background__actions">
      <IconButton variant="plain" :icon-size="16" :action="undo" :disabled="!wizard.canUndo.value" :disabled-body="t.tooltips.nothingToUndo" data-testid="convert-undo" @click="wizard.undo" />
      <IconButton variant="plain" :icon-size="16" :action="redo" :disabled="!wizard.canRedo.value" :disabled-body="t.tooltips.nothingToRedo" data-testid="convert-redo" @click="wizard.redo" />
      <AppButton v-if="wizard.hasMarks.value" variant="text" data-testid="convert-reset-marks" @click="wizard.resetMarks">{{ words.startOver }}</AppButton>
      <!-- The step to the other stage, at the right: secondary with an ink edge, as the accent is Create Project's. -->
      <span v-if="on" class="convert-background__next">
        <AppButton v-if="stage === 'find'" data-testid="convert-remove-found" @click="wizard.removeFound">{{ words.removeFound }}</AppButton>
        <AppButton v-else data-testid="convert-show-found" @click="wizard.showFound">{{ words.showFound }}</AppButton>
      </span>
    </div>
  </div>
</template>

<style scoped>
.convert-background {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.convert-background__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}

.convert-background__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  font: var(--type-control);
  font-weight: 600;
  color: var(--ink);
}

.convert-background__stage {
  margin: 0;
  font: var(--type-control);
  color: var(--ink);
}

.convert-background__found {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  margin: 0;
  font: var(--type-meta);
  color: var(--body);
}

.convert-background__hatch {
  flex: none;
  box-sizing: border-box;
  width: var(--space-20);
  height: var(--space-20);
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
  font: var(--type-meta);
  color: var(--muted);
}

/* The tool line, then a rule over the actions. */
.convert-background__tool {
  display: flex;
  align-items: flex-start;
  gap: var(--space-8);
  margin: 0;
  padding-bottom: var(--space-12);
  font: var(--type-meta-small);
  color: var(--muted);
  border-bottom: 1px solid var(--line-soft);
}

.convert-background__tool > :first-child {
  flex: none;
}

.convert-background__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
}

.convert-background__next {
  margin-left: auto;
}

.convert-background__next :deep(.app-button) {
  border-color: var(--ink);
}
</style>
