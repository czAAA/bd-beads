<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../AppIcon.vue'
import TextField from './TextField.vue'

/**
 * A number with its unit as a label on the border (ticket 149; NumberField card): a TextField of type number that asks for the numeric
 * keyboard on touch, `decimal` for a length in mm or cm and `numeric` for a count of beads. Optionally paired with a
 * compact up/down stepper (ticket 181) — narrow enough for the New Pattern form's own sidebar column, unlike the
 * Stepper card's wide − and + buttons — so a caller that wants the field settable entirely by clicking or tapping can
 * turn it on without giving up typing.
 */
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    whole?: boolean
    invalid?: boolean
    disabled?: boolean
    min?: number
    step?: number | 'any'
    stepper?: boolean
    /**
     * Digits only (ticket 211): a plain text input with the numeric keypad that drops anything but 0-9, typed or pasted,
     * and lets its placeholder go while focused (it returns on blur if the field is left empty).
     */
    digitsOnly?: boolean
    /** Required together whenever `stepper` is on: each button needs its own name for screen readers (Stepper card). */
    decreaseLabel?: string
    increaseLabel?: string
    /** The `data-testid` root the two buttons build "-decrease"/"-increase" onto, e.g. "width-input" → "width-input-decrease". */
    testidPrefix?: string
  }>(),
  {
    unit: undefined,
    whole: false,
    min: undefined,
    step: undefined,
    stepper: false,
    digitsOnly: false,
    decreaseLabel: undefined,
    increaseLabel: undefined,
    testidPrefix: undefined,
  },
)
const value = defineModel<string | number>()
const inputmode = computed(() => (props.whole || props.digitsOnly ? 'numeric' : 'decimal'))

/** Keeps a non-digit from ever landing while typing, so the caret stays where it was. */
function onBeforeInput(event: InputEvent): void {
  if (props.digitsOnly && event.data && /\D/.test(event.data)) event.preventDefault()
}

/** Catches what beforeinput can't see (paste, drop, autofill): strips the field down to its digits. */
function onInput(event: Event): void {
  if (!props.digitsOnly) return
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '')
  if (digits === input.value) return
  input.value = digits
  value.value = digits
}

/** How far one click of the stepper moves the value: the field's own `step`, or 1 when it has none or is 'any'. */
const stepAmount = computed(() => (typeof props.step === 'number' ? props.step : 1))

function currentValue(): number {
  const current = Number(value.value)
  return Number.isFinite(current) ? current : 0
}

/** Rounds off the float drift a repeated decimal step can leave (e.g. 0.1 + 0.2), to two decimal places — finer than any size unit is shown in. */
function rounded(n: number): number {
  return props.whole ? Math.round(n) : Math.round(n * 100) / 100
}

function applyStep(direction: 1 | -1): void {
  const next = currentValue() + direction * stepAmount.value
  value.value = String(rounded(props.min === undefined ? next : Math.max(props.min, next)))
}

/** Down turns away once a step down would pass the field's own minimum (Stepper card: "at the limit the button turns faint"). */
const decreaseDisabled = computed(() => props.disabled || (props.min !== undefined && currentValue() - stepAmount.value < props.min))
</script>

<template>
  <span class="number-field">
    <TextField
      v-model="value"
      :type="digitsOnly ? 'text' : 'number'"
      :inputmode="inputmode"
      :pattern="digitsOnly ? '[0-9]*' : undefined"
      :class="{ 'text-field__input--clear-on-focus': digitsOnly }"
      :unit="unit"
      :invalid="invalid"
      :disabled="disabled"
      :min="min"
      :step="step"
      v-bind="$attrs"
      @beforeinput="onBeforeInput"
      @input="onInput"
    />
    <span v-if="stepper" class="number-field__stepper">
      <button
        type="button"
        class="number-field__step"
        :data-testid="testidPrefix && `${testidPrefix}-increase`"
        :aria-label="increaseLabel"
        :disabled="disabled"
        @click="applyStep(1)"
      >
        <AppIcon name="chevron-up" :size="14" />
      </button>
      <button
        type="button"
        class="number-field__step"
        :data-testid="testidPrefix && `${testidPrefix}-decrease`"
        :aria-label="decreaseLabel"
        :disabled="decreaseDisabled"
        @click="applyStep(-1)"
      >
        <AppIcon name="chevron-down" :size="14" />
      </button>
    </span>
  </span>
</template>

<style scoped>
.number-field {
  display: flex;
  align-items: stretch;
  min-width: 0;
}

.number-field .text-field {
  flex: 1 1 auto;
  min-width: 0;
}

/* A native-spinner-sized column (ticket 181: "up/down" — not the Stepper card's wide − and + — so it fits this narrow sidebar), split into two equal buttons. */
.number-field__stepper {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 22px;
  margin-left: var(--space-6);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.number-field__step {
  display: flex;
  flex: 1 1 50%;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--muted);
  background: var(--elevated);
  border: 0;
  cursor: pointer;
}

.number-field__step:not(:last-child) {
  border-bottom: 1px solid var(--field-line);
}

.number-field__step:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: -2px;
}

@media (hover: hover) {
  .number-field__step:hover:not(:disabled) {
    color: var(--ink);
    background: var(--hover-fill);
  }
}

.number-field__step:active:not(:disabled) {
  background: var(--press-fill);
}

.number-field__step:disabled {
  color: var(--faint);
  background: var(--surface);
  cursor: not-allowed;
}

:root[data-theme='contrast'] .number-field__stepper {
  border-width: 2px;
}

:root[data-theme='contrast'] .number-field__step:not(:last-child) {
  border-bottom-width: 2px;
}
</style>
