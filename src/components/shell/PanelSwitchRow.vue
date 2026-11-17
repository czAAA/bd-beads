<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import InfoButton from '../ui/InfoButton.vue'
import type { IconName } from '../ui/icons'

// A panel's on/off row (Frame card, Letters; ExportPanel card, Large beads and Row by row, ticket 0916): the name in
// `control` with an Info button right after it holding what the switch does, and the switch at the right. In the Menu
// it starts with a PanelItem's icon, so its name stands in the label column (MenuPanel card, ticket 1042).
defineProps<{
  icon?: IconName
  label: string
  /** The Info button's name ("What Letters does") and its Tooltip. */
  infoLabel: string
  body: string
  /** The switch's test id; its Info button's is the same with `-info`. */
  testid: string
}>()
const on = defineModel<boolean>({ required: true })
</script>

<template>
  <div class="panel-switch-row">
    <AppIcon v-if="icon" :name="icon" :size="16" class="panel-switch-row__icon" />
    <span class="panel-switch-row__label">
      {{ label }}
      <InfoButton :label="infoLabel" :body="body" :data-testid="`${testid}-info`" />
    </span>
    <AppSwitch v-model="on" :label="label" :data-testid="testid" />
  </div>
</template>

<style scoped>
.panel-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10);
}

.panel-switch-row__icon {
  flex: none;
}

.panel-switch-row__label {
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--space-4);
  font: var(--type-control);
}
</style>
