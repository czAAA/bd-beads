<script setup lang="ts">
import { ref, useId } from 'vue'

// A single-line input (ticket 149): a `unit` is a label on the top border that cuts it (ticket 224) and reaches screen
// readers once, as the description; attributes go to the <input> itself. `compact` is the 2rem field of the Frame bar
// (ticket 517); `selectOnFocus` selects the text whenever the field takes focus.
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{ unit?: string; invalid?: boolean; disabled?: boolean; compact?: boolean; selectOnFocus?: boolean }>(), {
  unit: undefined,
})
const value = defineModel<string | number>()
const unitId = useId()
const input = ref<HTMLInputElement>()
// Set by a press on the field, cleared when it loses focus: a focus after it is the person's own (ticket 515).
const tapped = ref(false)

/** Focuses the field, selecting its text when asked. On a touch device nothing happens unless the person tapped the
 * field, so the virtual keyboard stays down (ticket 515); `preventScroll` keeps a clipped ancestor from scrolling. */
function focus(options: { select?: boolean } = {}) {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (touch && !tapped.value) return
  input.value?.focus({ preventScroll: true })
  if (options.select) input.value?.select()
}
defineExpose({ focus })
</script>

<template>
  <span class="text-field" :class="{ 'text-field--invalid': invalid, 'text-field--disabled': disabled, 'text-field--compact': compact }">
    <input
      ref="input"
      v-model="value"
      class="ui-control text-field__input"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      :aria-describedby="unit ? unitId : undefined"
      v-bind="$attrs"
      @pointerdown="tapped = true"
      @focus="selectOnFocus && input?.select()"
      @blur="tapped = false"
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

.text-field--compact {
  height: auto;
  min-height: 2rem;
  padding: 0 var(--space-6);
  background: var(--surface);
  border-color: var(--line-strong);
}

.text-field--compact .text-field__input {
  font: var(--type-title);
  font-size: 0.9375rem;
}

/* Off: a press goes to the group around it, so its Tooltip answers it. */
.text-field--compact.text-field--disabled {
  border-color: var(--line-strong);
  pointer-events: none;
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
  border-radius: var(--radius-md);
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
