<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useHoldRepeat } from '../../../composables/ui/useHoldRepeat'
import AppTooltip from '../AppTooltip.vue'

/**
 * The − value + control (ticket 149; Stepper card), for every counted setting on desktop: 40px tall, 40px buttons, the
 * value in `meta` between hairlines. At a limit that button turns `faint`; a locked stepper (`disabled`) is all `faint`
 * on `surface`, and its reason goes under it in words. Each button has its own name ("Fewer columns"), which the
 * Toolbox's Size controls also show as a Tooltip (`tooltip`, ticket 251); a stepper in a form or dialog shows none.
 * Ticket 355: holding a button repeats and speeds up (`useHoldRepeat`), and tapping the number turns it into a numeric
 * input (Enter or blur commits, Escape cancels, out of range is clamped, empty or invalid reverts); `valueLabel` names it.
 */
const props = withDefaults(
  defineProps<{
    min?: number
    max?: number
    decreaseLabel: string
    /** The name of the number for screen readers, e.g. "Width": it is a button that opens the number for typing (ticket 355). */
    valueLabel: string
    increaseLabel: string
    disabled?: boolean
    tooltip?: boolean
    /** Why the stepper is locked, shown by its buttons' Tooltips; the buttons then stay hoverable (`aria-disabled`). */
    disabledBody?: string
    decreaseTestid?: string
    increaseTestid?: string
    valueTestid?: string
    /** What the field shows when it is not the number itself, e.g. the width in mm for a count of beads (ticket 342). */
    display?: string
  }>(),
  { min: -Infinity, max: Infinity, tooltip: false, disabledBody: undefined, decreaseTestid: undefined, increaseTestid: undefined, valueTestid: undefined, display: undefined },
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

const editing = ref(false)
const draft = ref('')
const input = useTemplateRef<HTMLInputElement>('input')
const valueButton = useTemplateRef<HTMLButtonElement>('valueButton')

function clamp(n: number) {
  return Math.min(props.max, Math.max(props.min, n))
}

/** Steps by one, clamped to min/max; says whether the value moved, so a held press knows when it has reached a limit. */
function step(delta: number): boolean {
  if (props.disabled) return false
  // The model updates after the parent re-renders, so a typed number committed just now is the base, not `value`.
  const base = (editing.value ? closeEditor(true, false) : undefined) ?? value.value
  const next = clamp(base + delta)
  if (next === base && base === value.value) return false
  value.value = next
  return true
}

const hold = useHoldRepeat((direction) => step(direction))
const decreaseHandlers = hold.handlers(-1)
const increaseHandlers = hold.handlers(1)

/** Opens the number for typing (the click is kept from reaching a surrounding label, which would press the first button). */
async function startEditing(event: Event) {
  event.preventDefault()
  if (props.disabled || editing.value) return
  hold.stop()
  draft.value = String(value.value)
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

/** A plain number, whole or decimal; hex, exponents and the like are not a value (a decimal is rounded to a whole one). */
function typedNumber(text: string): number {
  const typed = text.trim().replace(',', '.')
  return /^[+-]?\d+(\.\d+)?$/.test(typed) ? Number(typed) : NaN
}

/** Closes the input and returns the number it committed, if any; it is clamped to min/max, empty or invalid input leaves the value as it was. */
function closeEditor(commit: boolean, refocus: boolean): number | undefined {
  if (!editing.value) return undefined
  editing.value = false
  const number = typedNumber(draft.value)
  const committed = commit && Number.isFinite(number) ? clamp(Math.round(number)) : undefined
  if (committed !== undefined) value.value = committed
  if (refocus) void nextTick(() => valueButton.value?.focus())
  return committed
}
const commitEdit = () => closeEditor(true, true)
const cancelEdit = () => closeEditor(false, true)
const commitOnBlur = () => closeEditor(true, false)

watch(
  () => props.disabled,
  (locked) => {
    if (locked) closeEditor(false, false)
  },
)
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
        v-on="decreaseHandlers"
      >
        −
      </button>
    </component>
    <span class="stepper__value" :data-testid="valueTestid">
      <button
        ref="valueButton"
        class="stepper__value-button"
        :class="{ 'stepper__value-button--hidden': editing }"
        type="button"
        :aria-label="valueLabel"
        :aria-hidden="editing || undefined"
        :tabindex="editing ? -1 : undefined"
        :disabled="disabled && !reasoned"
        :aria-disabled="reasoned || undefined"
        @click="startEditing"
      >
        {{ display ?? value }}
      </button>
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="stepper__input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        :aria-label="valueLabel"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent.stop="cancelEdit"
        @blur="commitOnBlur"
      />
    </span>
    <component :is="tooltipFor(increaseLabel, value < max) ? AppTooltip : 'span'" v-bind="tooltipFor(increaseLabel, value < max) ?? { class: 'stepper__slot' }">
      <button
        class="ui-control stepper__button"
        type="button"
        :aria-label="increaseLabel"
        :disabled="(disabled && !reasoned) || value >= max"
        :aria-disabled="reasoned || undefined"
        :data-testid="increaseTestid"
        v-on="increaseHandlers"
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
  touch-action: manipulation;
  user-select: none;
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
  position: relative;
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

/* The number is a button that looks like plain text, and the input lies over it so the stepper keeps its width while typing. */
.stepper__value-button {
  padding: 0;
  font: inherit;
  color: inherit;
  line-height: inherit;
  background: none;
  border: 0;
  cursor: text;
}

.stepper__value-button:disabled,
.stepper__value-button[aria-disabled='true'] {
  cursor: not-allowed;
}

.stepper__value-button--hidden {
  visibility: hidden;
}

.stepper__value-button:focus-visible,
.stepper__input:focus {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.stepper__input {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: center;
  background: var(--elevated);
  border: 0;
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
