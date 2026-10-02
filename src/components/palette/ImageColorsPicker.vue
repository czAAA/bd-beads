<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'

/**
 * The open Pattern's Image colors (CONTEXT.md, ADR 0011) as swatches in the Colors group, alongside the Palette: the
 * colors one Convert image found, so a converted Pattern can actually be touched up instead of offering only twelve
 * Palette colors none of its beads are.
 *
 * Deliberately the same shape and selection behaviour as PalettePicker, just keyed by hex rather than by a Palette
 * color id — a converted color has no id, it is only ever the hex the conversion produced. A Pattern created any other
 * way has no Image colors and this isn't rendered at all.
 */
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
    <button
      v-for="hex in colors"
      :key="hex"
      type="button"
      class="image-colors-picker__swatch"
      :class="{ 'image-colors-picker__swatch--selected': hex === selectedColor }"
      :style="{ backgroundColor: hex }"
      :title="`${t.convertImage.imageColorsLabel} ${hex}`"
      :aria-label="`${t.convertImage.imageColorsLabel} ${hex}`"
      :aria-pressed="hex === selectedColor"
      data-testid="image-color-swatch"
      :data-color-hex="hex"
      @click="emit('select', hex)"
    />
  </div>
</template>

<style scoped>
/* The popover's grid (ColorPickers card): seven columns of square swatches, the chosen one ringed like a Palette swatch. */
.image-colors-picker {
  display: grid;
  grid-template-columns: repeat(7, var(--image-color-size));
  gap: var(--space-6);
}

.image-colors-picker__swatch {
  width: var(--image-color-size);
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
  cursor: pointer;
}

.image-colors-picker__swatch--selected {
  box-shadow:
    inset 0 0 0 1px var(--swatch-edge),
    0 0 0 2px var(--overlay-fill),
    0 0 0 4px var(--ring);
}

.image-colors-picker__swatch:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 3px;
}
</style>
