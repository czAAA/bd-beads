<script setup lang="ts">
import { ref } from 'vue'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { usePalette, useRemoveAddedColor } from '../../composables/tools/usePalette'
import { PALETTE_SHORTCUTS, isAddedColorId } from '../../domain/palette'
import { useI18n } from '../../i18n/useI18n'
import AppSwatch from '../ui/AppSwatch.vue'

const props = defineProps<{ selectedColorId?: string }>()
const emit = defineEmits<{
  select: [colorId: string]
}>()
const { t } = useI18n()
const palette = usePalette()

/** The swatches are one Tab stop, the selected swatch (or the first); the arrows move between them (ticket 159). */
const gridEl = ref<HTMLElement>()
const roving = useRovingFocus(gridEl, '.palette-picker__swatch')
const removeAdded = useRemoveAddedColor()

function isStop(colorId: string, index: number): boolean {
  const selected = palette.value.some((color) => color.id === props.selectedColorId)
  return selected ? colorId === props.selectedColorId : index === 0
}

/**
 * An added swatch asks to be removed (tickets 228, 304; PaletteSwatches card): by its ×, or Delete or Backspace on a
 * focused one, which is how the keyboard reaches it. The app shell confirms before anything goes.
 */
function remove(colorId: string) {
  removeAdded?.(colorId)
}

function onSwatchKeydown(event: KeyboardEvent, colorId: string) {
  if (!removeAdded || !isAddedColorId(colorId) || (event.key !== 'Delete' && event.key !== 'Backspace')) return
  event.preventDefault()
  event.stopPropagation()
  remove(colorId)
}
</script>

<template>
  <div ref="gridEl" class="palette-picker" role="group" @keydown="roving.onKeydown" :aria-label="t.palette.pickerLabel" data-testid="palette-picker">
    <AppSwatch
      v-for="(color, index) in palette"
      :key="color.id"
      :color="color.hex"
      :label="isAddedColorId(color.id) ? color.hex : `${t.palette.colorLabel} ${index + 1}, ${t.colorNames[color.id] ?? color.hex}`"
      :selected="color.id === selectedColorId"
      :hotkey="PALETTE_SHORTCUTS[index] ? `Shift+${PALETTE_SHORTCUTS[index].keyLabel}` : undefined"
      :remove-label="removeAdded && isAddedColorId(color.id) ? t.palette.removeSwatch.replace('{hex}', color.hex) : undefined"
      class="palette-picker__swatch"
      :aria-keyshortcuts="removeAdded && isAddedColorId(color.id) ? 'Delete Backspace' : undefined"
      :tabindex="roving.tabIndexFor(isStop(color.id, index))"
      data-testid="palette-swatch"
      :data-tour="`color-${color.id}`"
      :data-color-id="color.id"
      @select="emit('select', color.id)"
      @remove="remove(color.id)"
      @keydown="onSwatchKeydown($event, color.id)"
    />
  </div>
</template>

<style scoped>
/* The swatch grid (PaletteSwatches card): 8 columns, 6px apart, square swatches with an inset edge. */
.palette-picker {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: var(--space-6);
}

/*
 * Touch input (ticket 166): a swatch grows to a real 36px minimum instead of controls.css's usual invisible 44px hit
 * area, which packed this tight (6px apart) would overlap its neighbours.
 */
@media (pointer: coarse) {
  /* The 8-column grid would overflow a narrow column at a real 36px minimum, so columns give way to more rows. */
  .palette-picker {
    grid-template-columns: repeat(auto-fill, minmax(var(--swatch-touch-min), 1fr));
    --swatch-min: var(--swatch-touch-min);
  }
}
</style>
