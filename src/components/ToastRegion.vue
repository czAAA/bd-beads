<script setup lang="ts">
import type { Toast } from '../composables/useToasts'
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
