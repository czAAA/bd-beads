<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
import InfoButton from '../ui/InfoButton.vue'
import type { IconName } from '../ui/icons'

// A panel row that states a fact and does nothing on a press (MenuPanel card, ticket 0936): a PanelItem's icon, label
// and value, with an Info button after the label holding why the fact matters. Not a button, so it can't look like a
// switch that won't turn on.
defineProps<{
  icon: IconName
  label: string
  value: string
  /** The Info button's name ("About keeping Projects") and its Tooltip. */
  infoLabel: string
  body: string
  /** The row's test id; its Info button's is the same with `-info`. */
  testid: string
}>()
</script>

<template>
  <div class="panel-fact-row" :data-testid="testid">
    <AppIcon :name="icon" :size="16" class="panel-fact-row__icon" />
    <span class="panel-fact-row__label">
      {{ label }}
      <InfoButton :label="infoLabel" :body="body" :data-testid="`${testid}-info`" />
    </span>
    <span class="panel-fact-row__value">{{ value }}</span>
  </div>
</template>

<style scoped>
.panel-fact-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-8);
  box-sizing: border-box;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--ink);
}

.panel-fact-row__icon {
  flex: none;
}

.panel-fact-row__label {
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--space-4);
  min-width: min-content;
}

.panel-fact-row__value {
  flex: none;
  margin-left: auto;
  font: var(--type-meta);
  color: var(--muted);
}
</style>
