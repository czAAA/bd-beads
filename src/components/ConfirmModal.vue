<script setup lang="ts">
import { useId } from 'vue'
import AppButton from './AppButton.vue'
import AppModal from './AppModal.vue'

/**
 * A confirmation (ticket 76; ConfirmDialogs card): the Modal template asking one question. The title is the question,
 * Cancel sits on the left and takes focus first, and the confirm button repeats the title (`writing.md`). A destructive
 * confirm is danger-filled (Delete all), any other is primary (Replace bead, Switch). The parent owns whether it's
 * mounted at all — usually via `v-if` — and decides what confirming/cancelling means. Cancel and the side action
 * take the in-box look, an `elevated` fill with a `line-strong` edge, so they stand out on the dialog in every theme.
 */
withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
    /** Turns the confirm button off while what the modal asks for isn't valid yet (Change size, ticket 153). */
    confirmDisabled?: boolean
    /** Styles the confirm as a destructive action; off for a confirmation that only moves the person along (ticket 154). */
    confirmDanger?: boolean
    /** A third, side action shown before Cancel (Import's "Save current", ticket 154); absent means there is none. */
    extraLabel?: string
    /** Shows the message as a problem, in the danger color and announced at once. */
    messageError?: boolean
  }>(),
  { confirmDisabled: false, confirmDanger: true, extraLabel: undefined, messageError: false },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
  extra: []
}>()

const messageId = useId()
</script>

<template>
  <AppModal
    :title="title"
    role="alertdialog"
    :describedby="messageId"
    data-testid="confirm-modal-dialog"
    @cancel="emit('cancel')"
  >
    <!-- Anything the question needs beyond a message: Change size's inputs, an error line under an import's. -->
    <slot />
    <p
      :id="messageId"
      class="confirm-modal__message"
      :class="{ 'confirm-modal__message--error': messageError }"
      :role="messageError ? 'alert' : undefined"
      data-testid="confirm-modal-message"
    >
      {{ message }}
    </p>
    <template #actions>
      <AppButton v-if="extraLabel" variant="in-box" class="confirm-modal__extra" data-testid="confirm-modal-extra" @click="emit('extra')">
        {{ extraLabel }}
      </AppButton>
      <AppButton variant="in-box" data-testid="confirm-modal-cancel" data-autofocus @click="emit('cancel')">
        {{ cancelLabel }}
      </AppButton>
      <AppButton
        :variant="confirmDanger ? 'danger' : 'primary'"
        data-testid="confirm-modal-confirm"
        :disabled="confirmDisabled"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.confirm-modal__message {
  font: var(--type-body);
  color: var(--body);
}

.confirm-modal__message--error {
  color: var(--danger);
}

/* A side action sits apart from the pair it doesn't belong to. */
.confirm-modal__extra {
  margin-right: auto;
}
</style>
