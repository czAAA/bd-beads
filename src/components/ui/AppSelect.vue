<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/**
 * A native select in the design system's look (ticket 157; Button card): `primary` is filled with the accent (Replace
 * bead), `secondary` sits on the page. The chevron is drawn over the native one, which is hidden. Every attribute and
 * listener (aria-label, :value, @change, data-testid) goes to the <select> itself; options come through the slot.
 */
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{ variant?: 'primary' | 'secondary'; disabled?: boolean }>(), { variant: 'secondary' })
</script>

<template>
  <span class="app-select" :class="`app-select--${variant}`">
    <select class="ui-control app-select__control" :disabled="disabled" v-bind="$attrs">
      <slot />
    </select>
    <AppIcon class="app-select__chevron" name="chevron-down" :size="15" />
  </span>
</template>

<style scoped>
.app-select {
  position: relative;
  display: inline-flex;
}

.app-select__control {
  height: var(--control-height);
  padding: 0 var(--space-32) 0 var(--space-12);
  font: var(--type-control);
  color: var(--ink);
  appearance: none;
  background: var(--button);
  border: 1px solid var(--button-line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}

.app-select__chevron {
  position: absolute;
  top: 50%;
  right: var(--space-10);
  color: var(--muted);
  pointer-events: none;
  transform: translateY(-50%);
}

.app-select--primary .app-select__control {
  color: var(--on-accent);
  background: var(--accent);
  border-color: var(--accent);
}

.app-select--primary .app-select__chevron {
  color: var(--on-accent);
}

/* The open list is drawn by the browser: keep its options readable on its own surface. */
.app-select__control option {
  color: var(--ink);
  background: var(--canvas);
}

.app-select__control:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

@media (hover: hover) {
  .app-select--secondary .app-select__control:hover:not(:disabled) {
    background: var(--hover-fill);
  }

  .app-select--primary .app-select__control:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }
}

.app-select--secondary .app-select__control:active:not(:disabled) {
  background: var(--press-fill);
}

.app-select__control:disabled {
  color: var(--faint);
  background: var(--surface);
  border-color: var(--line);
  cursor: not-allowed;
}

.app-select--primary .app-select__control:disabled {
  color: var(--accent-disabled-fg);
  background: var(--accent-disabled-bg);
  border-color: var(--accent-disabled-bg);
}

.app-select:has(:disabled) .app-select__chevron {
  color: var(--faint);
}

:root[data-theme='contrast'] .app-select__control {
  border-width: 2px;
}
</style>
