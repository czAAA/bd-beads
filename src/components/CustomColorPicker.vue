<script setup lang="ts">
import { useI18n } from '../i18n/useI18n'

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
  <label
    class="custom-color-picker"
    :class="{ 'custom-color-picker--selected': selected }"
    :style="color ? { backgroundColor: color } : undefined"
    :title="t.palette.customColorLabel"
  >
    <input
      type="color"
      class="custom-color-picker__input"
      data-testid="custom-color-input"
      :value="color ?? '#000000'"
      :aria-label="t.palette.customColorLabel"
      :aria-pressed="selected"
      @input="onInput"
    />
  </label>
</template>

<style scoped>
.custom-color-picker {
  display: inline-flex;
  width: 32px;
  height: 32px;
  padding: 0;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
  cursor: pointer;
  /* No color chosen yet: a rainbow ring hints this opens a color chooser, telling it apart from an empty Palette swatch. */
  background-image: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
}

.custom-color-picker--selected {
  outline: 3px solid var(--color-wedgewood);
  outline-offset: 2px;
}

.custom-color-picker__input {
  /* The real control: invisible but fills the whole label so any click on the swatch opens the native picker. */
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
