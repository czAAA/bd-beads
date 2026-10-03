<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { usePalette, useRemoveAddedColor } from '../../composables/tools/usePalette'
import { PALETTE_SHORTCUTS, isAddedColorId } from '../../domain/palette'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'

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
 * An added swatch is removed (ticket 228; PaletteSwatches card): by the × on the selected one, or Delete or Backspace on
 * a focused one, which is how the keyboard reaches it. Focus lands on the swatch before it, since the pressed one is gone.
 */
async function remove(colorId: string, index: number) {
  removeAdded?.(colorId)
  await nextTick()
  gridEl.value?.querySelectorAll<HTMLElement>('.palette-picker__swatch')[Math.max(0, index - 1)]?.focus()
}

function onSwatchKeydown(event: KeyboardEvent, colorId: string, index: number) {
  if (!removeAdded || !isAddedColorId(colorId) || (event.key !== 'Delete' && event.key !== 'Backspace')) return
  event.preventDefault()
  event.stopPropagation()
  void remove(colorId, index)
}
</script>

<template>
  <div ref="gridEl" class="palette-picker" role="group" @keydown="roving.onKeydown" :aria-label="t.palette.pickerLabel" data-testid="palette-picker">
    <span v-for="(color, index) in palette" :key="color.id" class="palette-picker__cell">
      <button
        type="button"
        class="ui-control palette-picker__swatch"
        :class="{ 'palette-picker__swatch--selected': color.id === selectedColorId }"
        :style="{ backgroundColor: color.hex }"
        :title="PALETTE_SHORTCUTS[index] ? `${t.palette.colorLabel} ${color.hex} (Shift+${PALETTE_SHORTCUTS[index].keyLabel})` : `${t.palette.colorLabel} ${color.hex}`"
        :aria-label="isAddedColorId(color.id) ? color.hex : `${t.palette.colorLabel} ${index + 1}, ${t.colorNames[color.id] ?? color.hex}`"
        :aria-pressed="color.id === selectedColorId"
        :aria-keyshortcuts="removeAdded && isAddedColorId(color.id) ? 'Delete Backspace' : undefined"
        :tabindex="roving.tabIndexFor(isStop(color.id, index))"
        data-testid="palette-swatch"
        :data-tour="`color-${color.id}`"
        :data-color-id="color.id"
        @click="emit('select', color.id)"
        @keydown="onSwatchKeydown($event, color.id, index)"
      />
      <button
        v-if="removeAdded && isAddedColorId(color.id) && color.id === selectedColorId"
        type="button"
        class="ui-control palette-picker__remove"
        :aria-label="t.palette.removeSwatch.replace('{hex}', color.hex)"
        tabindex="-1"
        data-testid="palette-swatch-remove"
        @click="remove(color.id, index)"
      >
        <AppIcon class="palette-picker__remove-icon" name="close" :size="14" />
      </button>
    </span>
  </div>
</template>

<style scoped>
/* The swatch grid (PaletteSwatches card): 8 columns, 6px apart, square swatches with an inset edge. */
.palette-picker {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: var(--space-6);
}

.palette-picker__cell {
  position: relative;
  display: block;
}

.palette-picker__swatch {
  aspect-ratio: 1;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
  cursor: pointer;
  transition: transform var(--duration-instant) var(--ease-standard);
}

.palette-picker__swatch--selected {
  box-shadow:
    inset 0 0 0 1px var(--swatch-edge),
    0 0 0 2px var(--panel),
    0 0 0 4px var(--ring);
}

.palette-picker__swatch:active {
  transform: scale(0.93);
}

.palette-picker__swatch:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 4px;
}

/* The removal × (PaletteSwatches card): a 16px round badge on the swatch's top-right corner, on the selected added swatch only. */
.palette-picker__remove {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 1;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  color: var(--ink);
  background: var(--panel);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
}

/* The × is drawn at 10px, smaller than the icon set's sizes. */
.palette-picker__remove-icon {
  width: 10px;
  height: 10px;
}

/* A fingertip needs more than 16px, but the usual 44px zone would cover the neighbouring swatches: 28px instead. */
@media (pointer: coarse) {
  .palette-picker__remove::before {
    width: 28px;
    height: 28px;
  }
}

.palette-picker__remove:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .palette-picker__swatch:active {
    transform: none;
  }
}

/*
 * Touch input (ticket 166): a swatch grows to a real 36px minimum instead of controls.css's usual invisible 44px hit
 * area, which packed this tight (6px apart) would overlap its neighbours.
 */
@media (pointer: coarse) {
  /* The 8-column grid would overflow a narrow column at a real 36px minimum, so columns give way to more rows. */
  .palette-picker {
    grid-template-columns: repeat(auto-fill, minmax(var(--swatch-touch-min), 1fr));
  }

  .palette-picker__swatch {
    min-width: var(--swatch-touch-min);
    min-height: var(--swatch-touch-min);
  }

  .palette-picker__swatch::before {
    content: none;
  }
}
</style>
