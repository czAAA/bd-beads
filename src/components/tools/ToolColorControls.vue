<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { usePalette } from '../../composables/tools/usePalette'
import { useCloseSheetOnPick } from '../shell/sheetContext'
import CustomColorPanel from '../palette/CustomColorPanel.vue'
import CustomColorPicker from '../palette/CustomColorPicker.vue'
import PalettePicker from '../palette/PalettePicker.vue'

// The Colors group's controls (ticket 384): the Palette (Pick color from canvas, ticket 398, is its last tile) and
// Custom color, in one place so the Color sheet and any other host show the same controls.
const props = defineProps<{
  selectedColorId?: string
  /** The last Custom color chosen (CONTEXT.md), kept on its slot even once a Palette swatch deselects it. */
  customColor?: string
}>()

const emit = defineEmits<{
  'select-color': [colorId: string]
  'select-custom-color': [hex: string]
}>()

/** Custom color is the active paint color exactly when no Palette swatch is (App.vue keeps the two mutually exclusive). */
const customColorSelected = computed(() => !props.selectedColorId && !!props.customColor)

// The Custom color picker expands under the grid (ticket 449) and does not close on use. Taking its color (press
// outside, Enter) hands it up once and closes the sheet holding this control; Escape returns to the button with nothing
// taken.
const palette = usePalette()
const closeSheet = useCloseSheetOnPick()
const pickerOpen = ref(false)
const panel = ref<InstanceType<typeof CustomColorPanel>>()
const customButton = ref<InstanceType<typeof CustomColorPicker>>()
const paintHex = computed(() => palette.value.find((color) => color.id === props.selectedColorId)?.hex)

function take(hex: string) {
  emit('select-custom-color', hex)
  leave()
}

function leave() {
  pickerOpen.value = false
  closeSheet()
}

function toggle() {
  if (pickerOpen.value) panel.value?.take()
  else pickerOpen.value = true
}

async function cancel() {
  pickerOpen.value = false
  await nextTick()
  customButton.value?.focus()
}
</script>

<template>
  <PalettePicker :selected-color-id="selectedColorId" @select="(colorId) => emit('select-color', colorId)">
    <CustomColorPicker ref="customButton" :selected="customColorSelected" :expanded="pickerOpen" @toggle="toggle" />
  </PalettePicker>
  <CustomColorPanel ref="panel" v-if="pickerOpen" :color="customColor ?? paintHex" @take="take" @leave="leave" @cancel="cancel" />
</template>
