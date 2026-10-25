<script setup lang="ts" generic="T extends string">
import { computed, nextTick, ref, useId } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import type { IconName } from '../ui/icons'

// A preference shown as its current value (MenuPanel card): the label on the row, a small button holding the value, and
// a menu under it, right-aligned, with a check on the chosen one. It applies at once; Enter, Space or Down opens it,
// arrows move, Escape closes only the picker. `bare` drops the visible label so several share a row; `disabled` says why.
const props = defineProps<{
  label: string
  icon?: IconName
  bare?: boolean
  disabled?: boolean
  disabledBody?: string
  options: readonly { value: T; label: string; icon?: IconName; lang?: string; /** What the button shows when the name is long (a language's code). */ shortLabel?: string }[]
}>()
const value = defineModel<T>({ required: true })

const open = ref(false)
const rootEl = ref<HTMLElement>()
const buttonEl = ref<HTMLElement>()
const listEl = ref<HTMLElement>()
const listId = useId()
const anchored = useAnchoredPosition(buttonEl, listEl, () => 'end')

const chosen = computed(() => props.options.find((option) => option.value === value.value))
/** The button's text: a code or word shown for the value; the name always says label and value. */
const shown = computed(() => chosen.value?.shortLabel ?? chosen.value?.label ?? '')

function items(): HTMLElement[] {
  return [...(listEl.value?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])]
}

async function show(focus: 'chosen' | 'last' = 'chosen') {
  open.value = true
  await nextTick()
  anchored.follow()
  const list = items()
  const target = focus === 'last' ? list.at(-1) : list[Math.max(0, props.options.findIndex((option) => option.value === value.value))]
  target?.focus()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  anchored.stop()
  if (returnFocus) buttonEl.value?.focus()
}

useOverlayLayer({ isOpen: () => open.value, root: () => rootEl.value, close: () => close(), onOutsidePress: () => close(false) })

function onButtonClick() {
  if (props.disabled) return
  if (open.value) close(false)
  else void show()
}

function onButtonKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    void show(event.key === 'ArrowUp' ? 'last' : 'chosen')
  } else if (event.key === 'ArrowRight' && !open.value) {
    event.preventDefault()
    void show()
  } else if (event.key === 'ArrowLeft' && open.value) {
    event.preventDefault()
    close()
  }
}

function choose(next: T) {
  value.value = next
  close()
}

function onListKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    // The Tab closes the list and carries on from its button; the panel's own Tab handling stays out of it.
    event.stopPropagation()
    close()
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    event.stopPropagation()
    return close()
  }
  const list = items()
  const current = list.indexOf(document.activeElement as HTMLElement)
  const last = list.length - 1
  const next =
    event.key === 'ArrowDown'
      ? current >= last ? 0 : current + 1
      : event.key === 'ArrowUp'
        ? current <= 0 ? last : current - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : undefined
  if (next === undefined) return
  event.preventDefault()
  // The panel's own arrow keys don't also run while moving inside the picker.
  event.stopPropagation()
  list[next]?.focus()
}
</script>

<template>
  <div ref="rootEl" class="panel-picker" :class="{ 'panel-picker--bare': bare }">
    <span v-if="!bare" class="panel-picker__label"><AppIcon v-if="icon" :name="icon" :size="16" />{{ label }}</span>
    <component
      :is="disabled && disabledBody ? AppTooltip : 'span'"
      v-bind="disabled && disabledBody ? { name: label, disabled: true, disabledBody, announce: false } : {}"
      class="panel-picker__wrap"
    >
      <button
        ref="buttonEl"
        class="ui-control panel-picker__button"
        :class="{ 'panel-picker__button--open': open }"
        type="button"
        aria-haspopup="menu"
        :aria-expanded="open"
        :aria-disabled="disabled || undefined"
        :aria-controls="open ? listId : undefined"
        :aria-label="`${label}: ${chosen?.label ?? ''}`"
        @click="onButtonClick"
        @keydown="onButtonKeydown"
      >
        <AppIcon v-if="chosen?.icon" :name="chosen.icon" :size="14" />
        <span class="panel-picker__value" :lang="chosen?.lang">{{ shown }}</span>
        <AppIcon name="chevron-down" :size="12" />
      </button>
    </component>
    <div v-if="open" :id="listId" ref="listEl" class="panel-picker__list" :style="anchored.style.value" role="menu" :aria-label="label" @keydown="onListKeydown">
      <button
        v-for="option in options"
        :key="option.value"
        class="ui-control panel-picker__option"
        type="button"
        role="menuitemradio"
        tabindex="-1"
        :aria-checked="option.value === value"
        :data-value="option.value"
        :lang="option.lang"
        @click="choose(option.value)"
      >
        <AppIcon v-if="option.value === value" name="check" :size="16" />
        <span v-else class="panel-picker__gap" aria-hidden="true" />
        <span>{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.panel-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  box-sizing: border-box;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--ink);
}

.panel-picker__label {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.panel-picker--bare {
  flex: 1 1 0;
  min-width: 0;
  padding: 0;
}

.panel-picker__wrap {
  display: block;
  min-width: 0;
}

.panel-picker--bare .panel-picker__wrap,
.panel-picker--bare .panel-picker__button {
  justify-content: space-between;
  width: 100%;
}

.panel-picker__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-picker__button[aria-disabled='true'] {
  color: var(--faint);
  cursor: default;
}

.panel-picker__button {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-4);
  box-sizing: border-box;
  height: var(--picker-height);
  padding: 0 var(--space-6) 0 var(--space-8);
  font: var(--type-pill);
  color: var(--ink);
  background: var(--button);
  border: 1px solid var(--button-line);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.panel-picker__button--open {
  border-color: var(--ink);
}

.panel-picker__button:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

@media (pointer: coarse) {
  .panel-picker__button {
    height: var(--picker-height-touch);
  }
}

.panel-picker__list {
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: var(--picker-menu-width);
  padding: var(--space-4);
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

:root[data-theme='contrast'] .panel-picker__list {
  border-width: var(--border-emphasis);
  box-shadow: none;
}

.panel-picker__option {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  width: 100%;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--ink);
  text-align: left;
  white-space: nowrap;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.panel-picker__option:focus {
  background: var(--overlay-hover);
}

.panel-picker__option:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

@media (hover: hover) {
  .panel-picker__option:hover {
    background: var(--overlay-hover);
  }
}

.panel-picker__gap {
  flex: none;
  width: 16px;
}
</style>
