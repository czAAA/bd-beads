<script setup lang="ts">
import { computed } from 'vue'
import CustomColorPicker from '../palette/CustomColorPicker.vue'
import ImageColorsButton from '../palette/ImageColorsButton.vue'
import PalettePicker from '../palette/PalettePicker.vue'

/**
 * The Colors group's controls (Toolbox card; ticket 384): the Palette (Pick color from canvas, ticket 398, is its
 * last tile), Custom color and Image colors, shared by the Toolbox and the phone Color sheet so a control changed in one place reaches
 * both.
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
</script>

<template>
  <PalettePicker :selected-color-id="selectedColorId" @select="(colorId) => emit('select-color', colorId)" />
  <div class="tool-color-controls__buttons">
    <CustomColorPicker :color="customColor" :selected="customColorSelected" @select="(hex) => emit('select-custom-color', hex)" />
    <ImageColorsButton :colors="imageColors" :selected-color="selectedImageColor" @select="(hex) => emit('select-image-color', hex)" />
  </div>
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
