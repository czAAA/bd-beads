<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'

/**
 * The Custom color button (tickets 75, 151; PaletteSwatches and ColorPickers cards): a 12px swatch of the chosen color,
 * hatched until one is chosen, then the label; the ring, like a Palette swatch, while it is the paint color. It opens
 * the system color picker, which can't be styled: the native input covers the whole button, invisible.
 */
defineProps<{
  /** The last color chosen here (CONTEXT.md's Custom color), kept on the slot for the rest of the session even after
   * a Palette swatch deselects it; undefined until one has ever been chosen. */
  color?: string
  /** Whether Custom color is the active paint color right now, as opposed to just remembered on this slot. */
  selected: boolean
}>()

const emit = defineEmits<{
  select: [hex: string]
}>()

const { t } = useI18n()

/**
 * The native picker reports every change here, including live drag-preview in browsers that fire 'input' while its
 * own dialog is still open — matching the ticket's "choosing a color immediately makes it the paint color".
 */
function onInput(event: Event) {
  emit('select', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <label class="custom-color-picker" :class="{ 'custom-color-picker--selected': selected }">
    <input
      type="color"
      class="custom-color-picker__input"
      data-testid="custom-color-input"
      :value="color ?? '#000000'"
      :aria-label="t.palette.customColorLabel"
      :aria-pressed="selected"
      @input="onInput"
    />
    <span
      class="custom-color-picker__swatch"
      :class="{ 'custom-color-picker__swatch--none': !color }"
      :style="color ? { backgroundColor: color } : undefined"
    />
    <span class="custom-color-picker__label">{{ t.palette.customColorLabel }}</span>
  </label>
</template>

<style scoped>
/* A Toolbox button (Button card, `toolbox`) holding the swatch and the label. */
.custom-color-picker {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  box-sizing: border-box;
  min-width: max-content;
  height: var(--control-height);
  margin: 0;
  padding: 0 var(--space-8);
  font: var(--type-tab);
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-md);
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

.custom-color-picker:has(:focus-visible) {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.custom-color-picker--selected {
  box-shadow:
    0 0 0 2px var(--panel),
    0 0 0 4px var(--ring);
}

.custom-color-picker__input {
  /* The real control: invisible but covering the whole button, so any click on it opens the native picker. */
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  cursor: pointer;
}

.custom-color-picker__swatch {
  flex: none;
  width: var(--swatch-dot);
  height: var(--swatch-dot);
  border-radius: var(--swatch-dot-radius);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

/* No color chosen yet: hatched, so it reads as "not set" rather than as a color. */
.custom-color-picker__swatch--none {
  background: repeating-linear-gradient(45deg, var(--faint) 0 1px, transparent 1px var(--space-4));
}

.custom-color-picker__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:root[data-theme='contrast'] .custom-color-picker {
  border: 2px solid var(--line-strong);
}
</style>
