<script setup lang="ts">
import { useId } from 'vue'
import AppSwitch from '../ui/AppSwitch.vue'
import InfoButton from '../ui/InfoButton.vue'

// A converter switch (ConvertImage card; tickets 0780, 0894): Keep the picture's shape, in the Size popover. A row on
// `surface`, the label in `control` with an Info button holding what the switch does, the switch at the right.
defineProps<{
  label: string
  /** The Info button's name ("What Remove background does") and its Tooltip: help read once, not a line kept under it. */
  info: { label: string; body: string }
  /** The switch's test id; its Info button's is the same with `-info`. */
  testid: string
}>()
const on = defineModel<boolean>({ required: true })
const labelId = useId()
</script>

<template>
  <div class="convert-switch-row" :data-testid="`${testid}-row`">
    <span class="convert-switch-row__label">
      <span :id="labelId">{{ label }}</span>
      <InfoButton :label="info.label" :body="info.body" :data-testid="`${testid}-info`" />
    </span>
    <AppSwitch v-model="on" :label="label" :aria-labelledby="labelId" :data-testid="testid" />
  </div>
</template>

<style scoped>
.convert-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  padding: var(--space-10) var(--space-12);
  background: var(--surface);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
}

.convert-switch-row__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  font: var(--type-control);
  color: var(--ink);
}
</style>
