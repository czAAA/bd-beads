<script setup lang="ts">
import type { Toast } from '../../composables/ui/useToasts'
import AppMessage from './AppMessage.vue'

/** Where toasts show (ticket 76): top-right of the canvas box on the toast layer (above sheets, below modals);
 * results go after 5s unless hovered or focused, errors stay. */
defineProps<{
  toasts: Toast[]
  /** The save ring shows (SaveReminder card, ticket 0796): toasts start 8px under it, so none covers it. */
  underRing?: boolean
}>()
const emit = defineEmits<{ dismiss: [id: string] }>()

const TOAST_MS = 5000
</script>

<template>
  <TransitionGroup tag="div" name="toast" class="toast-region" :class="{ 'toast-region--under-ring': underRing }" data-testid="toast-region">
    <AppMessage
      v-for="toast in toasts"
      :key="toast.stamp"
      :tone="toast.tone"
      placement="toast"
      :timeout="toast.tone === 'danger' || toast.persistent ? undefined : TOAST_MS"
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
  top: calc(var(--strip-height) + var(--space-16));
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

.toast-region--under-ring {
  top: calc(var(--strip-height) + var(--save-ring-inset) + var(--save-ring-size) + var(--space-8));
}

@media (pointer: coarse) {
  .toast-region--under-ring {
    top: calc(var(--strip-height) + var(--save-ring-inset) + var(--save-ring-size-touch) + var(--space-8));
  }
}

@media (max-width: 743px) {
  .toast-region--under-ring {
    top: calc(var(--strip-height) + var(--save-ring-inset-phone) + var(--save-ring-size-touch) + var(--space-8));
  }
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

/* Arriving 200ms, leaving 150ms, dropping in 8px (Motion card); reduced motion fades without the drop. */
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
  transform: translateY(calc(-1 * var(--space-8)));
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>
