<script setup lang="ts">
import { useId } from 'vue'
import AppButton from './AppButton.vue'
import AppModal from './AppModal.vue'

// A confirmation (ticket 76; ConfirmDialogs card): the Modal asking one question (the title); Cancel is
// left and takes focus first, the confirm button repeats the title (`writing.md`), danger-filled if destructive else
// primary. The parent owns mounting and what confirming/cancelling means. Cancel and side action use the in-box look.
withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
    /** Styles the confirm as a destructive action; off for a confirmation that only moves the person along (ticket
     * 154). */
    confirmDanger?: boolean
    /** A third, side action shown before Cancel (Import's "Save current", ticket 154); absent means there is none. */
    extraLabel?: string
  }>(),
  { confirmDanger: true, extraLabel: undefined },
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
    backdrop="swallow"
    :describedby="messageId"
    data-testid="confirm-modal-dialog"
    @cancel="emit('cancel')"
  >
    <!-- Anything the question needs beyond a message: a form's inputs, an error line under an import's. -->
    <slot />
    <p
      :id="messageId"
      class="confirm-modal__message"
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

/* A side action sits apart from the pair it doesn't belong to. */
.confirm-modal__extra {
  margin-right: auto;
}
</style>
