<script setup lang="ts">
import AppIcon from '../AppIcon.vue'

/**
 * The native select in the field look (ticket 149; NumberField card): 40px like a TextField, with a 16px `chevron-down`
 * in `muted`, so phones and iPads show their own picker. Attributes and v-model go to the <select> itself.
 */
defineOptions({ inheritAttrs: false })
defineProps<{ disabled?: boolean }>()
const value = defineModel<string>()
</script>

<template>
  <span class="field-select" :class="{ 'field-select--disabled': disabled }">
    <select v-model="value" class="ui-control field-select__control" :disabled="disabled" v-bind="$attrs">
      <slot />
    </select>
    <AppIcon class="field-select__chevron" name="chevron-down" :size="16" />
  </span>
</template>

<style scoped>
.field-select {
  position: relative;
  display: flex;
}

.field-select__control {
  box-sizing: border-box;
  width: 100%;
  height: var(--field-height);
  margin: 0;
  padding: 0 calc(var(--space-12) * 2 + 1rem) 0 var(--space-12);
  font: var(--type-body);
  color: var(--ink);
  text-overflow: ellipsis;
  appearance: none;
  background: var(--elevated);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.field-select__control:focus-visible {
  border-color: var(--ink);
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.field-select__control:disabled {
  color: var(--faint);
  background: var(--surface);
  border-color: var(--line);
  cursor: not-allowed;
}

.field-select__chevron {
  position: absolute;
  top: 50%;
  right: var(--space-12);
  color: var(--muted);
  pointer-events: none;
  transform: translateY(-50%);
}

.field-select--disabled .field-select__chevron {
  color: var(--faint);
}

:root[data-theme='contrast'] .field-select__control {
  border-width: 2px;
}
</style>
