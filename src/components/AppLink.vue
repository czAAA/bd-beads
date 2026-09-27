<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import type { IconName } from './icons'

/**
 * A button that reads as a link (ticket 157; Button card): Remove line in `ink`, Delete all in `danger`. Hover
 * underlines it; pressed fades it a little.
 */
withDefaults(defineProps<{ icon?: IconName; danger?: boolean; disabled?: boolean }>(), { icon: undefined })
</script>

<template>
  <button
    class="ui-control app-link"
    :class="{ 'app-link--danger': danger }"
    type="button"
    :disabled="disabled"
  >
    <AppIcon v-if="icon" :name="icon" :size="16" />
    <slot />
  </button>
</template>

<style scoped>
.app-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-6);
  padding: 0;
  font: var(--type-control);
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: var(--radius-xs);
  cursor: pointer;
  text-underline-offset: 3px;
  transition: opacity var(--duration-instant) var(--ease-standard);
}

.app-link--danger {
  color: var(--danger);
}

.app-link:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

@media (hover: hover) {
  .app-link:hover:not(:disabled) {
    text-decoration: underline;
  }
}

.app-link:active:not(:disabled) {
  opacity: 0.7;
}

/* High contrast keeps a pressed link at full strength and underlines it instead (accessibility.md). */
:root[data-theme='contrast'] .app-link:active:not(:disabled) {
  opacity: 1;
  text-decoration: underline;
  text-decoration-thickness: 2px;
}

.app-link:disabled {
  color: var(--faint);
  cursor: not-allowed;
}
</style>
