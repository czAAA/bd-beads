<script setup lang="ts">
import { useId } from 'vue'

/** A named section of a panel (MenuPanel card): `label` heading, then rows, split by a 1px `line-soft` rule; a named
 * group for screen readers. */
defineProps<{ label: string }>()
const labelId = useId()
</script>

<template>
  <section class="panel-section" role="group" :aria-labelledby="labelId">
    <h3 :id="labelId" class="panel-section__label">{{ label }}</h3>
    <slot />
  </section>
</template>

<style scoped>
.panel-section {
  padding: var(--space-8) 0 0;
}

.panel-section + .panel-section {
  margin-top: var(--space-8);
  border-top: 1px solid var(--line-soft);
}

.panel-section:first-child {
  padding-top: 0;
}

.panel-section__label {
  margin: 0;
  padding: var(--space-4) var(--space-12) var(--space-6);
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}
</style>
