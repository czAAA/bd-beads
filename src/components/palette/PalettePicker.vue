<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useMoveColor, usePalette, useRemoveAddedColor } from '../../composables/tools/usePalette'
import { useSwatchDrag } from '../../composables/tools/useSwatchDrag'
import { PALETTE_SHORTCUTS, isAddedColorId } from '../../domain/palette'
import { useI18n } from '../../i18n/useI18n'
import AppSwatch from '../ui/AppSwatch.vue'
import PickColorButton from './PickColorButton.vue'
import { useCloseSheetOnPick } from '../shell/sheetContext'

const props = defineProps<{ selectedColorId?: string }>()
const emit = defineEmits<{
  select: [colorId: string]
}>()
const { t } = useI18n()
const palette = usePalette()
const closeSheet = useCloseSheetOnPick()

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

/**
 * Rearranging (ticket 398): a swatch is dragged to another slot, or moved a slot with Alt+Left/Right. Each slot owns
 * its Shift+key, so the swatch that lands in the first one is Shift+1.
 */
const moveColor = useMoveColor()
const drag = useSwatchDrag(
  (from, to) => moveColor?.(from, to),
  (x, y) => {
    const id = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-color-id]')?.dataset.colorId
    const slot = palette.value.findIndex((color) => color.id === id)
    return slot < 0 ? undefined : slot
  },
)

async function nudge(slot: number, by: number) {
  const target = slot + by
  if (!moveColor || target < 0 || target >= palette.value.length) return
  const colorId = palette.value[slot]!.id
  moveColor(slot, target)
  await nextTick()
  gridEl.value?.querySelector<HTMLElement>(`[data-color-id="${colorId}"]`)?.focus()
}

/** Choosing a swatch is the end of the visit to a Dock sheet: it closes (nothing, in the Toolbox). */
function pick(colorId: string) {
  if (drag.consumeDrag()) return
  emit('select', colorId)
  closeSheet()
}

function onSwatchKeydown(event: KeyboardEvent, colorId: string, slot: number) {
  if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault()
    event.stopPropagation()
    void nudge(slot, event.key === 'ArrowLeft' ? -1 : 1)
    return
  }
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
      :class="{
        'palette-picker__swatch--dragging': drag.draggingFrom.value === index,
        'palette-picker__swatch--target': drag.draggingFrom.value !== undefined && drag.hoverSlot.value === index && drag.hoverSlot.value !== drag.draggingFrom.value,
      }"
      :aria-keyshortcuts="removeAdded && isAddedColorId(color.id) ? 'Delete Backspace' : undefined"
      :tabindex="roving.tabIndexFor(isStop(color.id, index))"
      data-testid="palette-swatch"
      :data-tour="`color-${color.id}`"
      :data-color-id="color.id"
      @select="pick(color.id)"
      @remove="remove(color.id)"
      @pointerdown="drag.onPointerDown($event, index)"
      @keydown="onSwatchKeydown($event, color.id, index)"
    />
    <PickColorButton class="palette-picker__pick" />
  </div>
</template>

<style scoped>
/* The swatch grid (PaletteSwatches card): 8 columns, 6px apart, square swatches with an inset edge. */
.palette-picker {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: var(--space-6);
}

/* A swatch being dragged to another slot (ticket 398), and the slot it would land in. */
.palette-picker :deep(.palette-picker__swatch--dragging) {
  opacity: 0.5;
}

.palette-picker :deep(.palette-picker__swatch--target) {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

/* Pick color from canvas is the grid's last tile (ticket 403): a swatch's size, with a bigger eyedropper. Not a slot: it isn't dragged and has no Shift+key. */
.palette-picker :deep(.palette-picker__pick),
.palette-picker :deep(.palette-picker__pick .icon-btn) {
  width: 100%;
  min-width: var(--swatch-min, 0);
  aspect-ratio: 1;
  height: auto;
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
