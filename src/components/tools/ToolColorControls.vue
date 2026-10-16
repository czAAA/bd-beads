<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { usePalette } from '../../composables/tools/usePalette'
import { useCloseSheetOnPick } from '../shell/sheetContext'
import CustomColorPanel from '../palette/CustomColorPanel.vue'
import CustomColorPicker from '../palette/CustomColorPicker.vue'
import ImageColorsButton from '../palette/ImageColorsButton.vue'
import PalettePicker from '../palette/PalettePicker.vue'

/**
 * The Colors group's controls (ticket 384): the Palette (Pick color from canvas, ticket 398, is its last
 * tile), Custom color and Image colors, kept in one place so the Color sheet and any other host show the same controls.
 */
const props = defineProps<{
  selectedColorId?: string
  /** The last Custom color chosen (CONTEXT.md), kept on its slot even once a Palette swatch deselects it. */
  customColor?: string
  /** The Image color being painted with right now (ticket 58), if that is what the paint color currently is. */
  selectedImageColor?: string
  /** The open Project's Image colors (ADR 0011), or none for a Project not made by converting an image. */
  imageColors?: readonly string[]
}>()

const emit = defineEmits<{
  'select-color': [colorId: string]
  'select-custom-color': [hex: string]
  'select-image-color': [hex: string]
}>()

/** Custom color is the active paint color exactly when neither a Palette swatch nor an Image color is (App.vue keeps the three mutually exclusive). */
const customColorSelected = computed(() => !props.selectedColorId && !props.selectedImageColor && !!props.customColor)

/**
 * The Custom color picker expands under the buttons (ticket 449) and does not close on use. It opens on the slot's Custom
 * color, else the paint color. Taking its color (a press outside, Enter) hands it up once and closes the sheet holding this
 * control; Escape goes back to the button with nothing taken.
 */
const palette = usePalette()
const closeSheet = useCloseSheetOnPick()
const pickerOpen = ref(false)
const panel = ref<InstanceType<typeof CustomColorPanel>>()
const customButton = ref<InstanceType<typeof CustomColorPicker>>()
const paintHex = computed(() => props.selectedImageColor ?? palette.value.find((color) => color.id === props.selectedColorId)?.hex)

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
  <PalettePicker :selected-color-id="selectedColorId" @select="(colorId) => emit('select-color', colorId)" />
  <div class="tool-color-controls__buttons">
    <CustomColorPicker ref="customButton" :selected="customColorSelected" :expanded="pickerOpen" @toggle="toggle" />
    <ImageColorsButton :colors="imageColors" :selected-color="selectedImageColor" @select="(hex) => emit('select-image-color', hex)" />
  </div>
  <CustomColorPanel ref="panel" v-if="pickerOpen" :color="customColor ?? paintHex" @take="take" @leave="leave" @cancel="cancel" />
</template>

<style scoped>
/* Side by side while both labels fit whole, one above the other when they don't (ticket 246). */
.tool-color-controls__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
  margin-top: var(--space-12);
}
</style>
