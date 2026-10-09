<script setup lang="ts" generic="T extends string">
import { ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import AppTooltip from '../AppTooltip.vue'
import type { IconName } from '../icons'

/**
 * Two or three always-visible choices (ticket 149; SegmentedControl card): Technique, Unit, Change from. A radiogroup
 * that is one tab stop: the arrows, Home and End move the choice, which follows focus. Options are 34px (28px `small`)
 * with a 2px inset; the chosen one is `ink` with `canvas` text. Words are in Inter, values and units (`mono`) in DM
 * Mono. An option may carry an `icon` before its label and a `tooltip` (name and body) shown on hover and focus. A label that doesn't fit wraps to two lines, and every option keeps the same height. A single word wider than
 * its share moves the option to the next row instead of being squeezed (ticket 231).
 */
const props = withDefaults(
  defineProps<{
    options: readonly { value: T; label: string; icon?: IconName; tooltip?: { name: string; body?: string; disabledBody?: string } }[]
    labelledby?: string
    mono?: boolean
    small?: boolean
    disabled?: boolean
  }>(),
  { labelledby: undefined },
)
const value = defineModel<T>({ required: true })
const rootEl = ref<HTMLElement>()

/** What an option's Tooltip says: while the control is disabled and gives a reason, that reason in place of the body (ADR 0035). */
function tipFor(tooltip: { name: string; body?: string; disabledBody?: string }) {
  if (props.disabled && tooltip.disabledBody !== undefined) {
    return { name: tooltip.name, disabled: true as const, disabledBody: tooltip.disabledBody, announce: false }
  }
  return { name: tooltip.name, body: tooltip.body, announce: false }
}

function choose(next: T, focus = false) {
  if (props.disabled) return
  value.value = next
  if (focus) rootEl.value?.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus()
}

function onKeydown(event: KeyboardEvent) {
  const index = props.options.findIndex((option) => option.value === value.value)
  const last = props.options.length - 1
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? Math.min(last, index + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? Math.max(0, index - 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : undefined
  if (next === undefined) return
  event.preventDefault()
  // The app's own hotkeys don't also run while choosing here.
  event.stopPropagation()
  choose(props.options[next]!.value, true)
}
</script>

<template>
  <div
    ref="rootEl"
    class="segmented"
    :class="{ 'segmented--mono': mono, 'segmented--small': small, 'segmented--disabled': disabled }"
    role="radiogroup"
    :aria-labelledby="labelledby"
    :aria-disabled="disabled || undefined"
    @keydown="onKeydown"
  >
    <template v-for="option in options" :key="option.value">
      <AppTooltip v-if="option.tooltip" class="segmented__tip" v-bind="tipFor(option.tooltip)">
        <button
          class="ui-control segmented__option"
          type="button"
          role="radio"
          :aria-checked="option.value === value"
          :tabindex="option.value === value ? 0 : -1"
          :data-value="option.value"
          :aria-disabled="disabled || undefined"
          @click="choose(option.value)"
        >
          <span class="segmented__face">
            <AppIcon v-if="option.icon" :name="option.icon" :size="16" />
            {{ option.label }}
          </span>
        </button>
      </AppTooltip>
      <button
        v-else
        class="ui-control segmented__option"
        type="button"
        role="radio"
        :aria-checked="option.value === value"
        :tabindex="option.value === value ? 0 : -1"
        :data-value="option.value"
        :aria-disabled="disabled || undefined"
        @click="choose(option.value)"
      >
        <span class="segmented__face">
          <AppIcon v-if="option.icon" :name="option.icon" :size="16" />
          {{ option.label }}
        </span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--space-2);
  box-sizing: border-box;
  padding: var(--space-2);
  background: var(--elevated);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
}

.segmented__tip {
  display: flex;
  flex: 1 1 0;
  min-width: min-content;
}

.segmented__face {
  display: inline-flex;
  gap: var(--space-6);
  align-items: center;
  justify-content: center;
}

.segmented__tip > .segmented__option {
  flex: 1 1 auto;
}

.segmented__option {
  display: grid;
  flex: 1 1 0;
  place-items: center;
  min-width: min-content;
  min-height: var(--control-height);
  padding: var(--space-4) var(--space-10);
  font: var(--type-tab);
  line-height: 1rem;
  color: var(--body);
  text-align: center;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.segmented--small .segmented__option {
  min-height: var(--control-height-small);
}

.segmented--mono .segmented__option {
  font: var(--type-meta);
}

@media (hover: hover) {
  .segmented__option:hover:not([aria-disabled='true'], [aria-checked='true']) {
    background: var(--hover-fill);
  }
}

.segmented__option[aria-checked='true'] {
  color: var(--canvas);
  background: var(--ink);
}

.segmented__option:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 1px;
}

.segmented--disabled {
  background: var(--surface);
  border-color: var(--line);
}

.segmented__option[aria-disabled='true'] {
  color: var(--faint);
  cursor: not-allowed;
}

.segmented__option[aria-disabled='true'][aria-checked='true'] {
  color: var(--surface);
  background: var(--faint);
}

:root[data-theme='contrast'] .segmented {
  border-width: 2px;
}

:root[data-theme='contrast'] .segmented__option[aria-checked='true'] {
  font-weight: 700;
}

@media (forced-colors: active) {
  .segmented__option[aria-checked='true'] {
    outline: 2px solid Highlight;
  }
}
</style>
