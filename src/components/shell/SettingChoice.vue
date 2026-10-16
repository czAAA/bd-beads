<script setup lang="ts" generic="T extends string">
import { computed, inject, ref, useId } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import type { IconName } from '../ui/icons'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import { PANEL_CONTEXT } from './panelContext'

/**
 * A preference shown as its choices (MenuPanel card): on the dropdown, a SegmentedControl, on the row beside its label
 * when it has two choices (`inline`) and stacked under it otherwise; in the Top sheet, one option per line, a radiogroup
 * with a check on the current one, since four segments do not fit a phone. Both are one control to the app: choosing
 * applies at once.
 */
const props = defineProps<{
  label: string
  icon?: IconName
  options: readonly { value: T; label: string; icon?: IconName; lang?: string; testid?: string }[]
  /** Two choices sit on the row beside the label. */
  inline?: boolean
}>()
const value = defineModel<T>({ required: true })
const context = inject(PANEL_CONTEXT)
const sheet = computed(() => context?.sheet.value ?? false)
const labelId = useId()
const listEl = ref<HTMLElement>()

const segments = computed(() =>
  props.options.map((option) => ({
    value: option.value,
    label: option.label,
    icon: option.icon,
    tooltip: { name: option.label },
  })),
)

/** The arrows move the choice and focus with it, as in a radio group; Home and End jump to the ends. */
function onKeydown(event: KeyboardEvent) {
  const index = props.options.findIndex((option) => option.value === value.value)
  const last = props.options.length - 1
  const next =
    event.key === 'ArrowDown' || event.key === 'ArrowRight' ? Math.min(last, index + 1)
    : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? Math.max(0, index - 1)
    : event.key === 'Home' ? 0
    : event.key === 'End' ? last
    : undefined
  if (next === undefined) return
  event.preventDefault()
  event.stopPropagation()
  value.value = props.options[next]!.value
  listEl.value?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
}
</script>

<template>
  <div v-if="sheet" class="setting setting--list" role="radiogroup" :aria-labelledby="labelId">
    <span :id="labelId" class="setting__label setting__label--heading">
      <AppIcon v-if="icon" :name="icon" :size="16" />{{ label }}
    </span>
    <div ref="listEl" class="setting__list" @keydown="onKeydown">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        class="ui-control setting__option"
        :class="{ 'setting__option--current': option.value === value }"
        :aria-checked="option.value === value"
        :tabindex="option.value === value ? 0 : -1"
        :lang="option.lang"
        :data-value="option.value"
        :data-testid="option.testid"
        @click="value = option.value"
      >
        <span class="setting__option-label">{{ option.label }}</span>
        <AppIcon v-if="option.value === value" class="setting__check" name="check" :size="18" />
      </button>
    </div>
  </div>
  <div v-else class="setting" :class="inline ? 'setting--inline' : 'setting--stack'">
    <span :id="labelId" class="setting__label">
      <AppIcon v-if="icon" :name="icon" :size="16" />{{ label }}
    </span>
    <SegmentedControl v-model="value" :options="segments" :labelledby="labelId" small />
  </div>
</template>

<style scoped>
.setting {
  display: flex;
  gap: var(--space-8);
  box-sizing: border-box;
  min-height: var(--panel-item-height);
  padding: var(--space-4) var(--space-12);
}

.setting--inline {
  align-items: center;
  justify-content: space-between;
}

.setting--stack,
.setting--list {
  flex-direction: column;
}

.setting__label {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  font: var(--type-control);
  color: var(--ink);
}

.setting__label--heading {
  min-height: var(--panel-item-height);
  font-weight: 600;
}

.setting--list {
  gap: 0;
  padding: 0 var(--space-12);
}

.setting__list {
  display: flex;
  flex-direction: column;
}

.setting__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  box-sizing: border-box;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-12) 0 calc(16px + var(--space-10) + var(--space-16));
  font: var(--type-control);
  color: var(--ink);
  text-align: left;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.setting__option--current {
  font-weight: 600;
}

.setting__option:active {
  background: var(--press-fill);
}

.setting__option:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.setting__check {
  flex: none;
  color: var(--accent-strong);
}

:root[data-theme='contrast'] .setting__check {
  color: var(--ink);
}
</style>
