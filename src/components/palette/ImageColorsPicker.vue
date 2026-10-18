<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'
import AppSwatch from '../ui/AppSwatch.vue'

// The open Project's Image colors (CONTEXT.md, ADR 0011) as swatches beside the Palette, so a converted Project can be
// touched up. Same shape and selection as PalettePicker but keyed by hex (a converted color has no id); not rendered
// for a Project without Image colors.
defineProps<{
  colors: readonly string[]
  /** The Image color being painted with right now, if any — mutually exclusive with a Palette or Custom color. */
  selectedColor?: string
}>()

const emit = defineEmits<{
  select: [hex: string]
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="image-colors-picker"
    role="group"
    :aria-label="t.convertImage.imageColorsLabel"
    data-testid="image-colors-picker"
  >
    <AppSwatch
      v-for="hex in colors"
      :key="hex"
      class="image-colors-picker__swatch"
      :color="hex"
      :label="`${t.convertImage.imageColorsLabel} ${hex}`"
      :selected="hex === selectedColor"
      data-testid="image-color-swatch"
      :data-color-hex="hex"
      @select="emit('select', hex)"
    />
  </div>
</template>

<style scoped>
/* The popover's grid (ColorPickers card): seven columns of square swatches, the chosen one ringed like a Palette
 * swatch. */
.image-colors-picker {
  --swatch-size: var(--image-color-size);
  --swatch-gap: var(--overlay-fill);
  display: grid;
  grid-template-columns: repeat(7, var(--image-color-size));
  gap: var(--space-6);
}
</style>
