<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/**
 * The expand button of an expandable panel (ticket 157; Button card): 28px round, a ↓ arrow while collapsed and ↑
 * while expanded, announced with aria-expanded. `label` names what it opens ("Show every color").
 */
defineProps<{ expanded: boolean; label: string; controls?: string }>()
</script>

<template>
  <button
    class="ui-control expand-btn"
    type="button"
    :aria-label="label"
    :aria-expanded="expanded"
    :aria-controls="controls"
  >
    <AppIcon :name="expanded ? 'arrow-up' : 'arrow-down'" :size="14" />
  </button>
</template>

<style scoped>
.expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--expand-size);
  height: var(--expand-size);
  padding: 0;
  color: var(--ink);
  background: none;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-instant) var(--ease-standard);
}

.expand-btn:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

@media (hover: hover) {
  .expand-btn:hover {
    background: var(--hover-fill);
  }
}

.expand-btn:active {
  background: var(--press-fill);
  transform: scale(var(--press-scale));
}

:root[data-theme='contrast'] .expand-btn {
  border-width: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .expand-btn:active {
    transform: none;
  }
}
</style>
