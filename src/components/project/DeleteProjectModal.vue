<script setup lang="ts">
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import ConfirmModal from '../ui/ConfirmModal.vue'

// Delete “{name}”? (ConfirmDialogs and ProjectPanel cards, ticket 0842): the one question every delete of a Project
// asks, wherever it starts. Save Project file is its side action, which saves and leaves the question open.
defineProps<{ name: string }>()
const emit = defineEmits<{ confirm: []; cancel: []; saveFile: [] }>()
const { t } = useI18n()
</script>

<template>
  <ConfirmModal
    data-testid="delete-project-modal"
    :title="fillBlanks(t.panels.project.deleteTitle, { name })"
    :message="fillBlanks(t.panels.project.deleteMessage, { name })"
    :confirm-label="t.panels.project.deleteConfirm"
    :cancel-label="t.panels.project.cancel"
    :extra-label="t.panels.project.saveFile"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
    @extra="emit('saveFile')"
  />
</template>
