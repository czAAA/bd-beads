<script setup lang="ts">
import { computed } from 'vue'
import AppTooltip from '../AppTooltip.vue'

/**
 * The − value + control (ticket 149; Stepper card), for every counted setting on desktop: 40px tall, 40px buttons, the
 * value in `meta` between hairlines. At a limit that button turns `faint`; a locked stepper (`disabled`) is all `faint`
 * on `surface`, and its reason goes under it in words. Each button has its own name ("Fewer columns"), which the
 * Toolbox's Size controls also show as a Tooltip (`tooltip`, ticket 251); a stepper in a form or dialog shows none.
 */
const props = withDefaults(
  defineProps<{
    min?: number
    max?: number
    decreaseLabel: string
    increaseLabel: string
    disabled?: boolean
    tooltip?: boolean
    /** Why the stepper is locked, shown by its buttons' Tooltips; the buttons then stay hoverable (`aria-disabled`). */
    disabledBody?: string
    decreaseTestid?: string
    increaseTestid?: string
    valueTestid?: string
  }>(),
  { min: -Infinity, max: Infinity, tooltip: false, disabledBody: undefined, decreaseTestid: undefined, increaseTestid: undefined, valueTestid: undefined },
)
const value = defineModel<number>({ required: true })

/** The Tooltip of one button: its name while it can act, the reason while the stepper is locked (ADR 0035); a limit shows none. */
function tooltipFor(name: string, canStep: boolean) {
  if (!props.tooltip) return undefined
  if (props.disabled) return props.disabledBody === undefined ? undefined : { name, disabled: true as const, disabledBody: props.disabledBody, announce: false }
  return canStep ? { name, announce: false } : undefined
}

/** A locked stepper with a reason stays focusable and hoverable, so the reason can be read. */
const reasoned = computed(() => props.disabled && props.disabledBody !== undefined)

function step(delta: number) {
  if (props.disabled) return
  const next = Math.min(props.max, Math.max(props.min, value.value + delta))
  if (next !== value.value) value.value = next
}
</script>

<template>
  <span class="stepper" :class="{ 'stepper--disabled': disabled }">
    <component :is="tooltipFor(decreaseLabel, value > min) ? AppTooltip : 'span'" v-bind="tooltipFor(decreaseLabel, value > min) ?? { class: 'stepper__slot' }">
      <button
        class="ui-control stepper__button"
        type="button"
        :aria-label="decreaseLabel"
        :disabled="(disabled && !reasoned) || value <= min"
        :aria-disabled="reasoned || undefined"
        :data-testid="decreaseTestid"
        @click="step(-1)"
      >
        −
      </button>
    </component>
    <span class="stepper__value" :data-testid="valueTestid">{{ value }}</span>
    <component :is="tooltipFor(increaseLabel, value < max) ? AppTooltip : 'span'" v-bind="tooltipFor(increaseLabel, value < max) ?? { class: 'stepper__slot' }">
      <button
        class="ui-control stepper__button"
        type="button"
        :aria-label="increaseLabel"
        :disabled="(disabled && !reasoned) || value >= max"
        :aria-disabled="reasoned || undefined"
        :data-testid="increaseTestid"
        @click="step(1)"
      >
        +
      </button>
    </component>
  </span>
</template>

<style scoped>
.stepper__slot {
  display: inline-flex;
}

.stepper {
  display: inline-flex;
  align-items: stretch;
  box-sizing: border-box;
  height: var(--field-height);
  background: var(--elevated);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-md);
}

.stepper__button {
  display: grid;
  place-items: center;
  width: var(--field-height);
  padding: 0;
  font: var(--type-title);
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
}

@media (hover: hover) {
  .stepper__button:hover:not(:disabled) {
    background: var(--hover-fill);
  }
}

.stepper__button:active:not(:disabled) {
  background: var(--press-fill);
}

.stepper__button:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 1px;
}

.stepper__button:disabled {
  color: var(--faint);
  cursor: not-allowed;
}

.stepper__value {
  display: grid;
  place-items: center;
  min-width: var(--stepper-value-width);
  padding: 0 var(--space-6);
  font: var(--type-meta);
  font-size: var(--stepper-value-size);
  color: var(--ink);
  border-right: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.stepper--disabled {
  background: var(--surface);
  border-color: var(--line);
}

.stepper--disabled .stepper__value {
  color: var(--faint);
}

:root[data-theme='contrast'] .stepper {
  border-width: 2px;
}
</style>
