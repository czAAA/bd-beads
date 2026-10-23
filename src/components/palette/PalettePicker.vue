<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useMoveColor, usePalette, useRecentColors, useRemoveAddedColor } from '../../composables/tools/usePalette'
import { useSwatchDrag } from '../../composables/tools/useSwatchDrag'
import { PALETTE_SHORTCUTS, RECENT_SHORTCUTS, isAddedColorId, slotsBesideRecents } from '../../domain/palette'
import { useI18n } from '../../i18n/useI18n'
import AppSwatch from '../ui/AppSwatch.vue'
import PickColorButton from './PickColorButton.vue'
import { useClosePopoverOnPick } from '../shell/pickContext'

const props = defineProps<{ selectedColorId?: string }>()
const emit = defineEmits<{
  select: [colorId: string]
}>()
const { t } = useI18n()
const palette = usePalette()
const recents = useRecentColors()
/** The swatches shown, with the slot each holds: a color that is one of the pill's recent chips is shown there only
 * (ticket 529) and comes back in its slot when it drops out. Shift+4…0 follow this order. */
const shown = computed(() => slotsBesideRecents(palette.value, recents.value).map((slot) => ({ color: palette.value[slot]!, slot })))
const closePanel = useClosePopoverOnPick()

/** The swatches are one Tab stop, the selected swatch (or the first); the arrows move between them (ticket 159). */
const gridEl = ref<HTMLElement>()
const roving = useRovingFocus(gridEl, '.palette-picker__swatch')
const removeAdded = useRemoveAddedColor()

function isStop(colorId: string, index: number): boolean {
  const selected = shown.value.some(({ color }) => color.id === props.selectedColorId)
  return selected ? colorId === props.selectedColorId : index === 0
}

// An added swatch asks to be removed (tickets 228, 304; PaletteSwatches card): by its ×, or Delete/Backspace on a
// focused one (the keyboard route). The app shell confirms first.
function remove(colorId: string) {
  removeAdded?.(colorId)
}

// Rearranging (ticket 398): drag a swatch to another slot, or move it with Alt+Left/Right. The shown swatches own
// Shift+4…0 in order, so the swatch landing in the first shown slot is Shift+4.
const moveColor = useMoveColor()
const drag = useSwatchDrag(
  (from, to) => moveColor?.(shown.value[from]!.slot, shown.value[to]!.slot),
  (x, y) => {
    const id = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-color-id]')?.dataset.colorId
    const position = shown.value.findIndex(({ color }) => color.id === id)
    return position < 0 ? undefined : position
  },
)

async function nudge(position: number, by: number) {
  const target = shown.value[position + by]
  if (!moveColor || !target) return
  const colorId = shown.value[position]!.color.id
  moveColor(shown.value[position]!.slot, target.slot)
  await nextTick()
  gridEl.value?.querySelector<HTMLElement>(`[data-color-id="${colorId}"]`)?.focus()
}

/** Choosing a swatch is the end of the visit to the colour popover (or a sheet): it closes. */
function pick(colorId: string) {
  if (drag.consumeDrag()) return
  emit('select', colorId)
  closePanel()
}

function onSwatchKeydown(event: KeyboardEvent, colorId: string, position: number) {
  if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault()
    event.stopPropagation()
    void nudge(position, event.key === 'ArrowLeft' ? -1 : 1)
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
      v-for="({ color, slot }, index) in shown"
      :key="color.id"
      :color="color.hex"
      :label="isAddedColorId(color.id) ? color.hex : `${t.palette.colorLabel} ${slot + 1}, ${t.colorNames[color.id] ?? color.hex}`"
      :selected="color.id === selectedColorId"
      :hotkey="PALETTE_SHORTCUTS[RECENT_SHORTCUTS + index] ? `Shift+${PALETTE_SHORTCUTS[RECENT_SHORTCUTS + index]!.keyLabel}` : undefined"
      :remove-label="removeAdded && isAddedColorId(color.id) ? t.palette.removeSwatch.replace('{hex}', color.hex) : undefined"
      class="palette-picker__swatch"
      :class="{
        'palette-picker__swatch--dragging': drag.draggingFrom.value === index,
        'palette-picker__swatch--target': drag.draggingFrom.value !== undefined && drag.hoverSlot.value === index && drag.hoverSlot.value !== drag.draggingFrom.value,
      }"
      :aria-keyshortcuts="removeAdded && isAddedColorId(color.id) ? 'Delete Backspace' : undefined"
      :tabindex="roving.tabIndexFor(isStop(color.id, index))"
      data-testid="palette-swatch"
      :data-color-id="color.id"
      @select="pick(color.id)"
      @remove="remove(color.id)"
      @pointerdown="drag.onPointerDown($event, index)"
      @keydown="onSwatchKeydown($event, color.id, index)"
    />
    <PickColorButton class="palette-picker__pick" />
    <slot />
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

/* Pick color from canvas is the grid's last tile (ticket 403): a swatch's size, with a bigger eyedropper. Not a
 * slot: it isn't dragged and has no Shift+key. */
.palette-picker :deep(.palette-picker__pick),
.palette-picker :deep(.palette-picker__pick .icon-btn) {
  width: 100%;
  min-width: var(--swatch-min, 0);
  aspect-ratio: 1;
  height: auto;
}

/* Touch (ticket 166): a real 36px minimum swatch instead of controls.css's invisible 44px hit area, which would
 * overlap at 6px apart. */
@media (pointer: coarse) {
  /* The 8-column grid would overflow a narrow column at a real 36px minimum, so columns give way to more rows. */
  .palette-picker {
    grid-template-columns: repeat(auto-fill, minmax(var(--swatch-touch-min), 1fr));
    --swatch-min: var(--swatch-touch-min);
  }
}
</style>
