<script setup lang="ts" generic="T extends string">
import { computed, useId } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import type { IconName } from '../ui/icons'
import SegmentedControl from '../ui/form/SegmentedControl.vue'

// A preference shown as its choices (MenuPanel card): a SegmentedControl, beside the label with two choices and
// stacked otherwise. It applies at once.
const props = defineProps<{
  label: string
  icon?: IconName
  options: readonly { value: T; label: string; icon?: IconName }[]
  /** Two choices sit on the row beside the label. */
  inline?: boolean
}>()
const value = defineModel<T>({ required: true })
const labelId = useId()

const segments = computed(() =>
  props.options.map((option) => ({
    value: option.value,
    label: option.label,
    icon: option.icon,
    tooltip: { name: option.label },
  })),
)
</script>

<template>
  <div class="setting" :class="inline ? 'setting--inline' : 'setting--stack'">
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

.setting--stack {
  flex-direction: column;
}

.setting__label {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  font: var(--type-control);
  color: var(--ink);
}
</style>
