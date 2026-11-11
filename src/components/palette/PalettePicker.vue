<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { loadCatalogWhen, useBeadColorsList } from '../../composables/palette/useBeadColors'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useMoveColor, usePalette, useRecentColors, useRemoveAddedColor } from '../../composables/tools/usePalette'
import { useSwatchDrag } from '../../composables/tools/useSwatchDrag'
import { PALETTE_SHORTCUTS, RECENT_SHORTCUTS, isAddedColorId, type PaletteColor } from '../../domain/palette'
import { colorLabel } from '../../i18n/colorLabel'
import { useI18n } from '../../i18n/useI18n'
import AppSwatch from '../ui/AppSwatch.vue'
import PickColorButton from './PickColorButton.vue'
import { useClosePopoverOnPick } from '../shell/pickContext'
import { fillBlanks } from '../../domain/fillBlanks'

const props = defineProps<{
  selectedColorId?: string
  /** Edit palette (ticket 531): a press on an added swatch asks to remove it, built-in ones are locked. */
  editing?: boolean
  /** The wide colour popover (ticket 0746): swatches of the usual size fill the width. */
  wide?: boolean
}>()
const emit = defineEmits<{
  select: [colorId: string]
}>()
const { t } = useI18n()
const palette = usePalette()
const recents = useRecentColors()
/** Every swatch stays in its slot (ticket 0865): a color that is one of the pill's recent chips is ringed there, not
 * taken out, so the grid never shifts as colors are used. Shift+4…0 are the first slots. */
const colors = computed(() => palette.value.colors)
const isRecent = (color: PaletteColor) => recents.value.includes(color.hex)
const closePanel = useClosePopoverOnPick()

// A swatch picked from the Bead's Color catalog is named from it (ticket 0760), so the catalog loads once one is held.
const beadColors = useBeadColorsList()
loadCatalogWhen(beadColors, () => colors.value.some((color) => !!color.code))
const labelOf = (color: PaletteColor) => colorLabel(t.value, color, beadColors?.catalog.value)

/** The swatches are one Tab stop, the selected swatch (or the first); the arrows move between them (ticket 159). */
const gridEl = ref<HTMLElement>()
const roving = useRovingFocus(gridEl, { selector: '.palette-picker__swatch' })
const removeAdded = useRemoveAddedColor()

function isStop(colorId: string, index: number): boolean {
  const selected = colors.value.some((color) => color.id === props.selectedColorId)
  return selected ? colorId === props.selectedColorId : index === 0
}

// An added swatch asks to be removed (tickets 228, 304, 531; PaletteSwatches card): by a press in Edit palette, or
// Delete/Backspace on a focused one. The app shell confirms first.
function remove(colorId: string) {
  removeAdded?.(colorId)
}

// Rearranging (ticket 398): drag a swatch to another slot, or move it with Alt+Left/Right. The slots own Shift+4…0 in
// order, so the swatch landing in the first slot is Shift+4.
const moveColor = useMoveColor()
const drag = useSwatchDrag(
  (from, to) => moveColor?.(from, to),
  (x, y) => {
    const id = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-color-id]')?.dataset.colorId
    const slot = colors.value.findIndex((color) => color.id === id)
    return slot < 0 ? undefined : slot
  },
)

async function nudge(slot: number, by: number) {
  if (!moveColor || !colors.value[slot + by]) return
  const colorId = colors.value[slot]!.id
  moveColor(slot, slot + by)
  await nextTick()
  gridEl.value?.querySelector<HTMLElement>(`[data-color-id="${colorId}"]`)?.focus()
}

/** Choosing a swatch is the end of the visit to the colour popover (or a sheet): it closes. In Edit palette a press
 * asks to remove an added swatch and does nothing on a built-in one. */
function pick(colorId: string) {
  if (drag.consumeDrag()) return
  if (props.editing) {
    if (isAddedColorId(colorId)) remove(colorId)
    return
  }
  emit('select', colorId)
  closePanel()
}

/** A swatch's name; in Edit palette an added one's is the removal it would ask for. */
function swatchLabel(color: PaletteColor, slot: number): string {
  if (!isAddedColorId(color.id)) return `${t.value.palette.colorLabel} ${slot + 1}, ${labelOf(color).text}`
  return props.editing && removeAdded ? fillBlanks(t.value.palette.removeSwatch, { hex: color.hex }) : labelOf(color).text
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
  <div ref="gridEl" class="palette-picker" :class="{ 'palette-picker--wide': wide }" role="group" @keydown="roving.onKeydown" :aria-label="t.palette.pickerLabel" data-testid="palette-picker">
    <AppSwatch
      v-for="(color, index) in colors"
      :key="color.id"
      :color="color.hex"
      :label="swatchLabel(color, index)"
      :tooltip-name="color.code ? labelOf(color).text : undefined"
      :selected="color.id === selectedColorId"
      :recent="isRecent(color)"
      :hotkey="PALETTE_SHORTCUTS[RECENT_SHORTCUTS + index] ? `Shift+${PALETTE_SHORTCUTS[RECENT_SHORTCUTS + index]!.keyLabel}` : undefined"
      :removable="editing && !!removeAdded && isAddedColorId(color.id)"
      :locked-body="editing && !isAddedColorId(color.id) ? t.palette.defaultColorLocked : undefined"
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
      @pointerdown="drag.onPointerDown($event, index)"
      @keydown="onSwatchKeydown($event, color.id, index)"
    />
    <PickColorButton class="palette-picker__pick" :disabled="editing" />
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

/* The wide colour popover (PaletteSwatches card): as many swatches of the usual size as fit, in fewer rows. */
.palette-picker--wide {
  grid-template-columns: repeat(auto-fill, minmax(var(--palette-swatch-min), 1fr));
}

/* A swatch being dragged to another slot (ticket 398), and the slot it would land in. */
.palette-picker :deep(.palette-picker__swatch--dragging) {
  opacity: 0.5;
}

.palette-picker :deep(.palette-picker__swatch--target) {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
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
