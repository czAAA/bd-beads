<script setup lang="ts">
import type { Toast } from '../../composables/ui/useToasts'
import AppMessage from './AppMessage.vue'

/**
 * Where toasts show (ticket 76; Message and StackingOrder cards): the bottom-right of the canvas box, 16px in, above
 * the Progress bar, on the toast layer (above sheets, below modals). A result goes after 5s unless hovered or focused;
 * an error stays until closed.
 */
defineProps<{ toasts: Toast[] }>()
const emit = defineEmits<{ dismiss: [id: string] }>()

const TOAST_MS = 5000
</script>

<template>
  <TransitionGroup tag="div" name="toast" class="toast-region" data-testid="toast-region">
    <AppMessage
      v-for="toast in toasts"
      :key="toast.stamp"
      :tone="toast.tone"
      placement="toast"
      :timeout="toast.tone === 'danger' ? undefined : TOAST_MS"
      :data-testid="toast.id"
      @close="emit('dismiss', toast.id)"
    >
      {{ toast.text }}
      <template v-if="toast.action" #actions>
        <button
          type="button"
          class="ui-control toast-region__action"
          data-testid="toast-action"
          @click="toast.action.run(); emit('dismiss', toast.id)"
        >
          {{ toast.action.label }}
        </button>
      </template>
    </AppMessage>
  </TransitionGroup>
</template>

<style scoped>
.toast-region {
  position: absolute;
  right: var(--space-16);
  bottom: var(--toast-bottom, var(--space-16));
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-8);
  pointer-events: none;
}

.toast-region > * {
  pointer-events: auto;
}

/* The text-button action (Message card, `bb-link`): underlined link text. */
.toast-region__action {
  padding: 0;
  border: 0;
  background: none;
  font: var(--type-control);
  color: var(--ink);
  text-decoration: underline;
  cursor: pointer;
}

/* Arriving 200ms, leaving 150ms, rising 8px (Motion card); reduced motion fades without the rise. */
.toast-enter-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.toast-leave-active {
  transition:
    opacity calc(var(--duration-base) * 0.75) var(--ease-in),
    transform calc(var(--duration-base) * 0.75) var(--ease-in);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(var(--space-8));
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>
