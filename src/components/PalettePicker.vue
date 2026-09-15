<script setup lang="ts">
import { PALETTE } from '../domain/palette'
import { useI18n } from '../i18n/useI18n'

defineProps<{ selectedColorId?: string }>()
const emit = defineEmits<{
  select: [colorId: string]
}>()
const { t } = useI18n()
</script>

<template>
  <div class="palette-picker" role="group" :aria-label="t.palette.pickerLabel" data-testid="palette-picker">
    <button
      v-for="color in PALETTE"
      :key="color.id"
      type="button"
      class="palette-picker__swatch"
      :class="{ 'palette-picker__swatch--selected': color.id === selectedColorId }"
      :style="{ backgroundColor: color.hex }"
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
