<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { usePanelSection } from '../../composables/shell/usePanelSection'
import AppIcon from '../ui/AppIcon.vue'

// A named section of a panel (MenuPanel card): a header button with the `label`, an optional `summary` (text, or the `summary` slot for a swatch) and a chevron,
// then rows, split by a 1px `line-soft` rule; a named group for screen readers. It folds shut, and stays so on this
// device: `id` is the panel and the section ("menu:projects"), every section open on a first visit; `info`, ticket 0790.
const props = defineProps<{
  label: string
  id: string
  summary?: string
  /** Shows the summary while the section is open too (Beads needed's total, ticket 555). */
  keepSummary?: boolean
  /** Closed every time it mounts and kept nowhere (Convert image's Review, ticket 0759), instead of per device by `id`. */
  closedFirst?: boolean
}>()
const labelId = useId()
const bodyId = useId()
const kept = usePanelSection(() => props.id)
const local = ref(false)
const open = computed(() => (props.closedFirst ? local.value : kept.open.value))
const toggle = () => (props.closedFirst ? (local.value = !local.value) : kept.toggle())
</script>

<template>
  <section class="panel-section" role="group" :aria-labelledby="labelId">
    <h3 v-if="!$slots.info" class="panel-section__heading">
      <button :id="labelId" class="ui-control panel-section__header" :class="{ 'panel-section__header--kept': keepSummary }" type="button" :aria-expanded="open" :aria-controls="bodyId" @click="toggle">
        <span class="panel-section__label">{{ label }}</span>
        <span v-if="(summary || $slots.summary) && (!open || keepSummary)" class="panel-section__summary" :class="{ 'panel-section__summary--kept': keepSummary }"><slot name="summary">{{ summary }}</slot></span>
        <AppIcon :name="open ? 'chevron-down' : 'chevron-left'" :size="14" class="panel-section__chevron" :class="{ 'panel-section__chevron--closed': !open }" />
      </button>
    </h3>
    <!-- With an Info button (ticket 0790): the header button lies under the row, so the Info button can stand after the label. -->
    <h3 v-else class="panel-section__heading panel-section__heading--info">
      <button :id="labelId" class="ui-control panel-section__header panel-section__header--under" type="button" :aria-label="summary && !open ? `${label}, ${summary}` : label" :aria-expanded="open" :aria-controls="bodyId" @click="toggle" />
      <span class="panel-section__row">
        <span class="panel-section__label panel-section__label--short" aria-hidden="true">{{ label }}</span>
        <span class="panel-section__info"><slot name="info" /></span>
        <span v-if="(summary || $slots.summary) && !open" class="panel-section__summary panel-section__summary--end" aria-hidden="true"><slot name="summary">{{ summary }}</slot></span>
        <AppIcon :name="open ? 'chevron-down' : 'chevron-left'" :size="14" class="panel-section__chevron" :class="{ 'panel-section__chevron--closed': !open, 'panel-section__chevron--end': open || !summary }" aria-hidden="true" />
      </span>
    </h3>
    <div v-if="open" :id="bodyId">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.panel-section + .panel-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--line-soft);
}

.panel-section__heading {
  margin: 0;
}

/* With an Info button: the header button fills the row under its content, which lets presses through but the Info
 * button's. */
.panel-section__heading--info {
  position: relative;
}

.panel-section__header--under {
  position: absolute;
  inset: 0;
}

.panel-section__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10);
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
  pointer-events: none;
}

.panel-section__label--short {
  flex: 0 1 auto;
}

.panel-section__info {
  display: inline-flex;
  margin-left: calc(-1 * var(--space-4));
  pointer-events: auto;
}

.panel-section__summary--end,
.panel-section__chevron--end {
  margin-left: auto;
}

.panel-section__summary--end + .panel-section__chevron {
  margin-left: 0;
}

.panel-section__header {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  width: 100%;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10);
  font: var(--type-label);
  color: var(--muted);
  text-align: left;
  text-transform: lowercase;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

@media (hover: hover) {
  .panel-section__header:hover {
    background: var(--hover-fill);
  }
}

.panel-section__header:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.panel-section__label {
  flex: 1 1 auto;
}

.panel-section__summary {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  font: var(--type-meta);
  text-overflow: ellipsis;
  text-transform: none;
  white-space: nowrap;
}

/* A kept summary (a total) is never shortened: with no room beside the label it takes a line of its own. */
.panel-section__header--kept {
  flex-wrap: wrap;
}

.panel-section__summary--kept {
  flex: none;
}

/* The design system draws one chevron-left; right is it turned. */
.panel-section__chevron--closed {
  transform: rotate(180deg);
}
</style>
