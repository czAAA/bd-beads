<script setup lang="ts">
import { useId } from 'vue'

/**
 * A single-line input (ticket 149; TextField and NumberField cards): 40px, `elevated` fill, a `field-line` border,
 * 14px text with 12px padding, the placeholder in `muted`. Focus is an `ink` border and the focus ring; `invalid` is a
 * `danger` border; disabled is `surface` with `faint` text. A `unit` is a label on the top border, 12px from the right, in `meta-small` on a patch that cuts the border (ticket 224;
 * NumberField card); it takes the border's color and reaches screen readers once, as the input's description. Attributes
 * (id, type, min, step, inputmode, data-testid) go to the <input> itself.
 */
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{ unit?: string; invalid?: boolean; disabled?: boolean }>(), { unit: undefined })
const value = defineModel<string | number>()
const unitId = useId()
</script>

<template>
  <span class="text-field" :class="{ 'text-field--invalid': invalid, 'text-field--disabled': disabled }">
    <input
      v-model="value"
      class="ui-control text-field__input"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      :aria-describedby="unit ? unitId : undefined"
      v-bind="$attrs"
    />
    <span v-if="unit" :id="unitId" class="text-field__unit" aria-hidden="true">{{ unit }}</span>
  </span>
</template>

<style scoped>
.text-field {
  position: relative;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--field-height);
  padding: 0 var(--space-12);
  background: var(--elevated);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-md);
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.text-field:focus-within {
  border-color: var(--ink);
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.text-field--invalid {
  border-color: var(--danger);
}

.text-field--disabled {
  background: var(--surface);
  border-color: var(--line);
}

.text-field__input {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0;
  font: var(--type-body);
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: 0;
  outline: none;
  -moz-appearance: textfield;
}

.text-field__input::-webkit-outer-spin-button,
.text-field__input::-webkit-inner-spin-button {
  margin: 0;
  -webkit-appearance: none;
}

.text-field__input::placeholder {
  color: var(--muted);
  opacity: 1;
}

.text-field__input--clear-on-focus:focus::placeholder {
  color: transparent;
}

.text-field__input:disabled {
  color: var(--faint);
}

.text-field__unit {
  position: absolute;
  top: 0;
  right: var(--space-12);
  padding: 0 var(--space-4);
  font: var(--type-meta-small);
  color: var(--muted);
  white-space: nowrap;
  background: var(--elevated);
  pointer-events: none;
  transform: translateY(-50%);
}

.text-field:focus-within .text-field__unit {
  color: var(--ink);
}

.text-field--invalid .text-field__unit {
  color: var(--danger);
}

.text-field--disabled .text-field__unit {
  color: var(--faint);
  background: var(--surface);
}

:root[data-theme='contrast'] .text-field {
  border-width: 2px;
}
</style>
