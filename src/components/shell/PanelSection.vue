<script setup lang="ts">
import { useId } from 'vue'
import { usePanelSection } from '../../composables/shell/usePanelSection'
import AppIcon from '../ui/AppIcon.vue'

// A named section of a panel (MenuPanel card): a header button with the `label`, an optional `summary` (text, or the `summary` slot for a swatch) and a chevron,
// then rows, split by a 1px `line-soft` rule; a named group for screen readers. It folds shut, and stays so on this
// device: `id` is the panel and the section ("menu:projects"), every section open on a first visit.
const props = defineProps<{ label: string; id: string; summary?: string }>()
const labelId = useId()
const bodyId = useId()
const { open, toggle } = usePanelSection(() => props.id)
</script>

<template>
  <section class="panel-section" role="group" :aria-labelledby="labelId">
    <h3 class="panel-section__heading">
      <button :id="labelId" class="ui-control panel-section__header" type="button" :aria-expanded="open" :aria-controls="bodyId" @click="toggle">
        <span class="panel-section__label">{{ label }}</span>
        <span v-if="(summary || $slots.summary) && !open" class="panel-section__summary"><slot name="summary">{{ summary }}</slot></span>
        <AppIcon :name="open ? 'chevron-down' : 'chevron-left'" :size="14" class="panel-section__chevron" :class="{ 'panel-section__chevron--closed': !open }" />
      </button>
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
  outline-offset: 2px;
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

/* The design system draws one chevron-left; right is it turned. */
.panel-section__chevron--closed {
  transform: rotate(180deg);
}
</style>
