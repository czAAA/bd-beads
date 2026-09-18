<script setup lang="ts">
import { useI18n } from '../i18n/useI18n'

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
/*
 * Its own wrapping row inside the Colors group rather than flowing into the Palette's grid (the group marks this
 * .tool-group__full-row), so Image colors read as a set of their own next to the twelve fixed swatches instead of
 * running on from them.
 */
.image-colors-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-colors-picker__swatch {
  width: 32px;
  height: 32px;
  padding: 0;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.image-colors-picker__swatch--selected {
  outline: 3px solid var(--color-wedgewood);
  outline-offset: 2px;
}
</style>
