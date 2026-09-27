<script setup lang="ts">
import { useId } from 'vue'
import AppIcon from './AppIcon.vue'
import type { IconName } from './icons'

/**
 * A rarely used Tool group as one full-width row (ticket 75; DisclosureRow card): icon, label, its current values
 * right-aligned, and a chevron. Pressing it opens the group's controls in place, below the row, pushing what follows
 * down; the chevron turns up. The controls stay in the page while closed (hidden), so their hotkeys keep working.
 */
defineProps<{ icon: IconName; label: string; summary?: string }>()
const open = defineModel<boolean>('open', { required: true })
const panelId = useId()
</script>

<template>
  <section class="disclosure-row" :class="{ 'disclosure-row--open': open }">
    <button
      class="ui-control disclosure-row__head"
      type="button"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
    >
      <AppIcon :name="icon" :size="16" />
      <span class="disclosure-row__label">{{ label }}</span>
      <span v-if="summary" class="disclosure-row__summary">{{ summary }}</span>
      <AppIcon class="disclosure-row__chevron" :name="open ? 'chevron-up' : 'chevron-down'" :size="16" />
    </button>
    <div v-show="open" :id="panelId" class="disclosure-row__panel">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.disclosure-row {
  border-bottom: 1px solid var(--panel-rule);
}

.disclosure-row__head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  width: 100%;
  padding: var(--space-10) 0;
  color: var(--ink);
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.disclosure-row__label {
  font: var(--type-control);
}

.disclosure-row__summary {
  margin-left: auto;
  font: var(--type-meta);
  color: var(--muted);
  white-space: nowrap;
}

.disclosure-row__chevron {
  color: var(--muted);
}

.disclosure-row__label + .disclosure-row__chevron {
  margin-left: auto;
}

.disclosure-row__head:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

@media (hover: hover) {
  .disclosure-row__head:hover .disclosure-row__label {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

.disclosure-row__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
  padding: 0 0 var(--space-12);
}
</style>
