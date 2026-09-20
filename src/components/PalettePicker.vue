<script setup lang="ts">
import { PALETTE } from '../domain/palette'
import { useI18n } from '../i18n/useI18n'

defineProps<{ selectedColorId?: string }>()
const emit = defineEmits<{
  select: [colorId: string]
}>()
const { t } = useI18n()

/**
 * Shift+1..9, Shift+0, Q, W (ticket 88), in Palette order -- what each swatch's tooltip appends. Locale-neutral
 * (digits/letters read the same in every language), so built here rather than through i18n, the same way other
 * shortcut hints in Toolbox.vue are.
 */
const COLOR_SHORTCUT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Q', 'W']
</script>

<template>
  <div class="palette-picker" role="group" :aria-label="t.palette.pickerLabel" data-testid="palette-picker">
    <button
      v-for="(color, index) in PALETTE"
      :key="color.id"
      type="button"
      class="palette-picker__swatch"
      :class="{ 'palette-picker__swatch--selected': color.id === selectedColorId }"
      :style="{ backgroundColor: color.hex }"
      :title="`${t.palette.colorLabel} ${color.hex} (Shift+${COLOR_SHORTCUT_KEYS[index]})`"
      :aria-label="`${t.palette.colorLabel} ${color.hex}`"
      :aria-pressed="color.id === selectedColorId"
      data-testid="palette-swatch"
      :data-color-id="color.id"
      @click="emit('select', color.id)"
    />
  </div>
</template>

<style scoped>
.palette-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.palette-picker__swatch {
  width: 32px;
  height: 32px;
  padding: 0;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.palette-picker__swatch--selected {
  outline: 3px solid var(--color-wedgewood);
  outline-offset: 2px;
}
</style>
