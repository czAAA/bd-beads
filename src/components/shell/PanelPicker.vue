<script setup lang="ts" generic="T extends string">
import { computed, nextTick, ref, useId } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import AppIcon from '../ui/AppIcon.vue'
import type { IconName } from '../ui/icons'

// A preference shown as its current value (MenuPanel card): the label on the row, a small button holding the value, and
// a menu under it, right-aligned, with a check on the chosen one. It applies at once. Enter, Space or Down opens it on
// the chosen item, arrows move, Escape closes only the picker. It replaces SettingChoice.
const props = defineProps<{
  label: string
  icon?: IconName
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
  if (open.value) close(false)
  else void show()
}

function onButtonKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    void show(event.key === 'ArrowUp' ? 'last' : 'chosen')
  }
}

function choose(next: T) {
  value.value = next
  close()
}

function onListKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') return close(false)
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
  <div ref="rootEl" class="panel-picker">
    <span class="panel-picker__label"><AppIcon v-if="icon" :name="icon" :size="16" />{{ label }}</span>
    <button
      ref="buttonEl"
      class="ui-control panel-picker__button"
      :class="{ 'panel-picker__button--open': open }"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? listId : undefined"
      :aria-label="`${label}: ${chosen?.label ?? ''}`"
      @click="onButtonClick"
      @keydown="onButtonKeydown"
    >
      <AppIcon v-if="chosen?.icon" :name="chosen.icon" :size="14" />
      <span :lang="chosen?.lang">{{ shown }}</span>
      <AppIcon name="chevron-down" :size="12" />
    </button>
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
  outline-offset: 2px;
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
  outline-offset: -1px;
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
