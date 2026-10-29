<script setup lang="ts">
import { useMarginSwatches } from '../../composables/canvas/useMarginSwatches'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import BackgroundColorPicker from '../palette/BackgroundColorPicker.vue'

// The margin color's picker (tickets 0656, 0657; MarginSheet card): the background color picker with Auto, the theme's
// five Canvas colors and Custom color. The same one in the Frame panel's margin section and the sheet's popover.
const props = defineProps<{
  /** The Project whose Canvas's Background Auto follows (ticket 0666). */
  project: Project
}>()
const { t } = useI18n()
const picker = useMarginSwatches(() => props.project)
</script>

<template>
  <BackgroundColorPicker
    v-if="picker.offered.value"
    :swatches="picker.swatches.value"
    :label="t.frame.margin.colorLabel"
    :selected-id="picker.selectedId.value"
    :custom-color="picker.customColor.value"
    data-testid="margin-color-picker"
    @select="picker.choose"
    @select-custom="picker.chooseCustom"
  />
</template>
