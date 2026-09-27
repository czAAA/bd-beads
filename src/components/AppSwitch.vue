<script setup lang="ts">
/**
 * An on/off switch (ticket 144; ProgressBar and SwitchAndFileButton cards): a 30 × 18 track with a 12px knob,
 * `role="switch"`, named by `label`. On is the accent track with the knob at the right; off is a quiet track with a
 * white knob at the left. `v-model` holds whether it is on.
 */
defineProps<{ label: string; disabled?: boolean }>()
const on = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    class="ui-control app-switch"
    type="button"
    role="switch"
    :aria-checked="on"
    :aria-label="label"
    :disabled="disabled"
    @click="on = !on"
  >
    <span class="app-switch__knob" />
  </button>
</template>

<style scoped>
.app-switch {
  position: relative;
  flex: none;
  width: var(--switch-width);
  height: var(--switch-height);
  padding: 0;
  background: var(--switch-off);
  border: 0;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

.app-switch__knob {
  position: absolute;
  top: calc((var(--switch-height) - var(--switch-knob)) / 2);
  left: calc((var(--switch-height) - var(--switch-knob)) / 2);
  width: var(--switch-knob);
  height: var(--switch-knob);
  background: var(--canvas);
  border-radius: var(--radius-full);
  transition: transform var(--duration-fast) var(--ease-standard);
}

:root[data-theme='dark'] .app-switch__knob {
  background: var(--ink);
}

.app-switch[aria-checked='true'] {
  background: var(--accent);
}

.app-switch[aria-checked='true'] .app-switch__knob {
  background: var(--on-accent);
  transform: translateX(calc(var(--switch-width) - var(--switch-height)));
}

.app-switch:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.app-switch:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (prefers-reduced-motion: reduce) {
  .app-switch__knob {
    transition: none;
  }
}
</style>
