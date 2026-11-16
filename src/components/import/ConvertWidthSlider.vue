<script setup lang="ts">
import { computed } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { useConvertSizeReadings } from '../../composables/import/useConvertSizeReadings'
import { useI18n } from '../../i18n/useI18n'
import ValueSlider from '../ui/form/ValueSlider.vue'

// The Width slider of the column and of the phone's Width sheet (ConvertImage card DS-1, DS-4; tickets 0896, 0911): the
// doubling scale, its value in both units, off before a picture. Its #action slot holds "More for the size".
const { t } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const readings = useConvertSizeReadings(wizard)
const has = computed(() => wizard.hasPicture.value)
const offBody = computed(() => (has.value ? undefined : words.value.addPictureFirst))
/** A value an off slider shows before a picture (DS-1). */
const NONE = '—'
</script>

<template>
  <ValueSlider
    :label="t.form.widthLabel"
    :model-value="wizard.sizing.value.width"
    :min="wizard.sizing.value.range.min"
    :max="wizard.sizing.value.range.max"
    :value="has ? readings.width.value.value : NONE"
    :secondary="has ? readings.width.value.secondary : undefined"
    :valuetext="has ? readings.width.value.valuetext : NONE"
    :min-label="has ? readings.width.value.minLabel : ''"
    :max-label="has ? readings.width.value.maxLabel : ''"
    :marks="has ? readings.widthMarks.value : undefined"
    :off-body="offBody"
    doubling
    testid="convert-width"
    @update:model-value="wizard.setWidth"
  >
    <template #action><slot name="action" /></template>
  </ValueSlider>
</template>
