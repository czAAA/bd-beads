<script setup lang="ts">
import { computed } from 'vue'
import type { ConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import { controlAction } from '../../composables/shell/controlRegistry'
import { CONVERT_STEPS } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import StepBar from '../canvas/StepBar.vue'

// Convert image's Progress bar (ticket 0756; ConvertImage and ProgressBar cards): the five steps as named dots with Back
// and Next, and Create Project in Next's place on Review. Every step after Picture waits for a picture.
const props = defineProps<{ wizard: ConvertImageWizard }>()
const emit = defineEmits<{ create: [] }>()

const { t } = useI18n()
const words = computed(() => t.value.convertImage.wizard)

/** Each step's name comes from the registry (ticket 0650), so the dot, its Tooltip and its accessible name are one. */
const steps = computed(() =>
  CONVERT_STEPS.map((step) => ({
    id: step,
    label: controlAction(`convert-step-${step}`).name(t.value),
    disabled: !props.wizard.canGoTo(step),
    testid: `convert-step-${step}`,
  })),
)
const finish = computed(() => ({
  label: t.value.convertImage.createButton,
  disabled: !props.wizard.hasPicture.value,
  disabledBody: words.value.addPictureFirst,
  testid: 'convert-image-create',
}))
</script>

<template>
  <StepBar
    :step="wizard.stepIndex.value"
    :steps="steps"
    :track-label="words.railLabel"
    :go-to="(label) => fillBlanks(words.goToStep, { step: label })"
    :back-label="words.stepBack"
    :next-label="words.stepNext"
    :first-body="words.firstStepBody"
    :next-disabled-body="words.addPictureFirst"
    :finish="finish"
    testid="convert"
    @go="wizard.goTo(CONVERT_STEPS[$event])"
    @finish="emit('create')"
  />
</template>
