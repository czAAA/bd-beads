<script setup lang="ts">
import { ref } from 'vue'
import { useRovingFocus } from '../composables/useRovingFocus'
import { PALETTE, PALETTE_SHORTCUTS } from '../domain/palette'
import { useI18n } from '../i18n/useI18n'

const props = defineProps<{ selectedColorId?: string }>()
const emit = defineEmits<{
  select: [colorId: string]
}>()
const { t } = useI18n()

/** The swatches are one Tab stop, the selected swatch (or the first); the arrows move between them (ticket 159). */
const gridEl = ref<HTMLElement>()
const roving = useRovingFocus(gridEl)

function isStop(colorId: string, index: number): boolean {
  const selected = PALETTE.some((color) => color.id === props.selectedColorId)
  return selected ? colorId === props.selectedColorId : index === 0
}
</script>

<template>
  <div ref="gridEl" class="palette-picker" role="group" @keydown="roving.onKeydown" :aria-label="t.palette.pickerLabel" data-testid="palette-picker">
    <button
      v-for="(color, index) in PALETTE"
      :key="color.id"
      type="button"
      class="ui-control palette-picker__swatch"
      :class="{ 'palette-picker__swatch--selected': color.id === selectedColorId }"
      :style="{ backgroundColor: color.hex }"
      :title="`${t.palette.colorLabel} ${color.hex} (Shift+${PALETTE_SHORTCUTS[index]!.keyLabel})`"
      :aria-label="`${t.palette.colorLabel} ${index + 1}, ${t.colorNames[color.id] ?? color.hex}`"
      :aria-pressed="color.id === selectedColorId"
      :tabindex="roving.tabIndexFor(isStop(color.id, index))"
      data-testid="palette-swatch"
      :data-tour="`color-${color.id}`"
      :data-color-id="color.id"
      @click="emit('select', color.id)"
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
