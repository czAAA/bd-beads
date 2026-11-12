<script setup lang="ts">
import AppIcon from '../components/ui/AppIcon.vue'
import type { IconName } from '../components/ui/icons'

// A phone's grouped list (ticket 0827; Homepage card): What's inside's rows and the coffee screen's promises, one panel
// of rows parted by hairlines, each an icon tile beside its name over its line. Nothing to press but a row's action, from
// its `action-<id>` slot under its line (the coffee screen's Open source and Say hello, ticket 0880).
defineProps<{
  rows: readonly { id: string; icon: IconName; name: string; text: string }[]
  /** Prefix of the test ids: the list is `<testid>`'s, each row `<rowTestid>-<id>`. */
  testid: string
  rowTestid: string
}>()
</script>

<template>
  <ul class="grouped-list" :data-testid="testid">
    <li v-for="row in rows" :key="row.id" class="grouped-list__row" :data-testid="`${rowTestid}-${row.id}`">
      <span class="grouped-list__tile"><AppIcon :name="row.icon" :size="18" /></span>
      <span class="grouped-list__words">
        <span class="grouped-list__name">{{ row.name }}</span>
        <!-- The stop keeps a screen reader from running the name into its line. -->
        <span class="grouped-list__stop">. </span>
        <span class="grouped-list__line">{{ row.text }}</span>
        <span v-if="$slots[`action-${row.id}`]" class="grouped-list__action"><slot :name="`action-${row.id}`" /></span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
/* On `panel`, a 1px `panel-rule` edge and `radius-lg`, the rows parted by `panel-rule` hairlines. */
.grouped-list {
  flex: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--panel);
  border: 1px solid var(--panel-rule);
  border-radius: var(--radius-lg);
}

.grouped-list__row {
  display: grid;
  grid-template-columns: var(--grouped-tile) minmax(0, 1fr);
  column-gap: var(--space-12);
  align-items: center;
  padding: var(--space-12) var(--space-14);
}

.grouped-list__row + .grouped-list__row {
  border-top: 1px solid var(--panel-rule);
}

/* The icon tile: 36px, 10px corners, `accent` at 12%, the icon in `accent-strong`. */
.grouped-list__tile {
  display: grid;
  place-items: center;
  width: var(--grouped-tile);
  height: var(--grouped-tile);
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: var(--grouped-tile-radius);
}

.grouped-list__words {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.grouped-list__name {
  font: var(--type-grouped-name);
  color: var(--ink);
}

.grouped-list__stop {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.grouped-list__line {
  font: var(--type-body);
  color: var(--body);
}

/* A row's action, 6px under its line, at its own width. */
.grouped-list__action {
  display: flex;
  margin-top: var(--space-6);
}
</style>
