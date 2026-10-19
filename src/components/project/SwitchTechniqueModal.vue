<script setup lang="ts">
import ConfirmModal from '../ui/ConfirmModal.vue'
import NetSizeField from './NetSizeField.vue'
import type { Technique } from '../../domain/weave'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'

// The question before a layer's Technique changes (ticket 507, ADR 0038): how many drawn beads have no place in the new
// Technique and that the picture may look different, and for Netting its Net size in the same step. The parent owns
// what confirming or cancelling means.
defineProps<{
  question: { technique: Technique; lost: number; drawn: boolean; asksNetSize: boolean; netSize: number }
}>()
defineEmits<{ confirm: []; cancel: []; 'update:net-size': [netSize: number] }>()

const { t } = useI18n()
</script>

<template>
  <ConfirmModal
    data-testid="switch-technique-modal"
    :title="t.frame.switchConfirmTitle"
    :message="
      question.drawn
        ? t.frame.switchConfirmMessage.replace('{technique}', techniqueName(t, question.technique)).replace('{count}', String(question.lost))
        : t.frame.switchNetMessage
    "
    :confirm-label="t.frame.switchConfirmButton"
    :cancel-label="t.frame.removeConfirmCancel"
    :confirm-danger="false"
    @confirm="$emit('confirm')"
    @cancel="$emit('cancel')"
  >
    <NetSizeField v-if="question.asksNetSize" :model-value="question.netSize" testid="switch-net-size" @update:model-value="$emit('update:net-size', $event)" />
  </ConfirmModal>
</template>
