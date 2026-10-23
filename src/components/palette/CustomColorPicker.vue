<script setup lang="ts">
import { computed, ref } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import AppTooltip from '../ui/AppTooltip.vue'

// The Custom color tile (tickets 75, 151, 449; PaletteSwatches and ColorPickers cards): a swatch-sized tile after Pick
// color from canvas, the hatched square in `muted` with a + inside, ringed while it is the paint color. It opens
// CustomColorPanel under the grid; a second press takes its color and closes it.
defineProps<{
  /** Whether Custom color is the active paint color right now, as opposed to just remembered on this slot. */
  selected: boolean
  /** Whether the picker is open under the button. */
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const { t } = useI18n()
const buttonEl = ref<HTMLButtonElement>()

defineExpose({ focus: () => buttonEl.value?.focus() })

/** Its Tooltip (ticket 335) comes from the registry's Custom color action. */
const action = controlAction('custom-color')
const tooltip = computed(() => ({ name: action.name(t.value), body: action.body?.(t.value), announce: false }))
</script>

<template>
  <AppTooltip v-bind="tooltip" class="custom-color-picker-wrap">
    <button
      ref="buttonEl"
      type="button"
      class="custom-color-picker"
      :class="{ 'custom-color-picker--selected': selected }"
      :aria-pressed="selected"
      :aria-expanded="expanded"
      :aria-label="t.palette.customColorLabel"
      data-testid="custom-color-button"
      @click="emit('toggle')"
    >
      <span class="custom-color-picker__swatch" />
      <svg class="custom-color-picker__plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>
    </button>
  </AppTooltip>
</template>

<style scoped>
/* The Tooltip's wrapper is a grid cell: a swatch's size, like Pick color from canvas. */
.custom-color-picker-wrap {
  display: block;
  width: 100%;
  min-width: var(--swatch-min, 0);
  aspect-ratio: 1;
}

.custom-color-picker {
  position: relative;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-standard);
}

:root[data-theme='dark'] .custom-color-picker {
  border-color: var(--elevated);
}

@media (hover: hover) {
  .custom-color-picker:hover {
    border-color: var(--ink);
  }
}

.custom-color-picker:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.custom-color-picker--selected {
  box-shadow:
    0 0 0 2px var(--panel),
    0 0 0 4px var(--ring);
}

/* Today's hatched glyph, filling the tile; the + sits over it. */
.custom-color-picker__swatch {
  position: absolute;
  inset: var(--space-4);
  border-radius: var(--swatch-dot-radius);
  background: repeating-linear-gradient(45deg, var(--muted) 0 1px, transparent 1px var(--space-4));
}

.custom-color-picker__plus {
  position: relative;
  width: 50%;
  height: 50%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

:root[data-theme='contrast'] .custom-color-picker {
  border: 2px solid var(--line-strong);
}
</style>
