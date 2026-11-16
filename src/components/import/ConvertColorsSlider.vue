<script setup lang="ts">
import { computed } from 'vue'
import { useConvertColorsReadings } from '../../composables/import/useConvertColorsReadings'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { MIN_IMAGE_COLORS } from '../../domain/imageConversion'
import { useI18n } from '../../i18n/useI18n'
import ValueSlider from '../ui/form/ValueSlider.vue'

// The Colors slider of the column and of the phone's Colors sheet (ConvertImage card DS-1, DS-2, DS-4; tickets 0904,
// 0928, 0911): 1 to "40+", the reach of what changes the beads, off before a picture. Its #action slot holds "More".
const { t } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const has = computed(() => wizard.hasPicture.value)
const offBody = computed(() => (has.value ? undefined : words.value.addPictureFirst))
const NONE = '—'
const { colorsEnd, colorsMarks, colorsValue, colorsReach, colorsMaxLabel } = useConvertColorsReadings()
</script>

<template>
  <ValueSlider
    :label="words.colorsLabel"
    :model-value="wizard.maxColors.value"
    :min="MIN_IMAGE_COLORS"
    :max="colorsEnd"
    :value="has ? colorsValue : NONE"
    :valuetext="has ? colorsValue : NONE"
    :min-label="has ? String(MIN_IMAGE_COLORS) : ''"
    :max-label="has ? colorsMaxLabel : ''"
    :marks="has ? colorsMarks : undefined"
    :reach="has ? colorsReach : undefined"
    :off-body="offBody"
    doubling
    :page-step="5"
    testid="convert-colors-slider"
    @update:model-value="wizard.setMaxColors"
  >
    <template #action><slot name="action" /></template>
  </ValueSlider>
</template>
