<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'

/**
 * A reusable in-app confirmation dialog, styled like the rest of the app rather than the browser's own `confirm()`
 * (ticket 42's Delete all is the first caller). The parent owns whether it's mounted at all — usually via `v-if` —
 * and decides what confirming/cancelling means; this component only asks the question and reports the answer.
 */
defineProps<{
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const titleId = useId()
const messageId = useId()
const cancelButtonEl = ref<HTMLButtonElement | null>(null)

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('cancel')
  }
}

// Bound to the window rather than the dialog itself: like the app's other Escape handling (see App.vue), nothing
// here takes keyboard focus reliably enough to rely on a local keydown handler.
onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  cancelButtonEl.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="confirm-modal" data-testid="confirm-modal-backdrop" @click.self="emit('cancel')">
    <div
      class="confirm-modal__dialog"
      data-testid="confirm-modal-dialog"
      role="alertdialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="messageId"
    >
      <h2 :id="titleId" class="confirm-modal__title">{{ title }}</h2>
      <p :id="messageId" class="confirm-modal__message">{{ message }}</p>
      <div class="confirm-modal__actions">
        <button
          ref="cancelButtonEl"
          type="button"
          data-testid="confirm-modal-cancel"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="button--danger"
          data-testid="confirm-modal-confirm"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--color-ink) 55%, transparent);
}

.confirm-modal__dialog {
  width: min(380px, 100%);
  padding: 24px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.confirm-modal__title {
  margin: 0 0 12px;
}

.confirm-modal__message {
  margin: 0 0 24px;
}

.confirm-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
