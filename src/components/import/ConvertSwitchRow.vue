<script setup lang="ts">
import { useId } from 'vue'
import AppSwitch from '../ui/AppSwitch.vue'

// A switch with a line saying what its state does (ConvertImage card; ticket 0780): Remove background and Keep the
// picture's shape. A row on `surface`, the label in `control` over the line in `small`, the switch at the right.
defineProps<{ label: string; line: string; testid: string }>()
const on = defineModel<boolean>({ required: true })
const labelId = useId()
</script>

<template>
  <div class="convert-switch-row" :data-testid="`${testid}-row`">
    <div class="convert-switch-row__text">
      <span :id="labelId" class="convert-switch-row__label">{{ label }}</span>
      <p class="convert-switch-row__line" :data-testid="`${testid}-line`">{{ line }}</p>
    </div>
    <AppSwitch v-model="on" :label="label" :aria-labelledby="labelId" :data-testid="testid" />
  </div>
</template>

<style scoped>
.convert-switch-row {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-10) var(--space-12);
  background: var(--surface);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
}

.convert-switch-row__text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.convert-switch-row__label {
  font: var(--type-control);
  color: var(--ink);
}

.convert-switch-row__line {
  margin: 0;
  font: var(--type-small);
  color: var(--muted);
}
</style>
