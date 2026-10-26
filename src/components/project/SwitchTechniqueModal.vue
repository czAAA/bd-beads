<script setup lang="ts">
import { computed } from 'vue'
import ConfirmModal from '../ui/ConfirmModal.vue'
import BrickBlockField from './BrickBlockField.vue'
import NetSizeField from './NetSizeField.vue'
import type { Technique } from '../../domain/weave'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'

// The question before a layer's Technique, Net size or Brick block changes (tickets 507, 568, ADR 0038): the beads that
// would be lost, and the Technique's settings. `keeps` is a Net size change inside the same Technique. The parent owns
// what confirming or cancelling means.
const props = defineProps<{
  question: {
    technique: Technique
    lost: number
    drawn: boolean
    keeps: boolean
    asksNetSize: boolean
    netSize: number
    asksBrickBlock: boolean
    brickBlock: number
  }
}>()
defineEmits<{ confirm: []; cancel: []; 'update:net-size': [netSize: number]; 'update:brick-block': [brickBlock: number] }>()

const { t } = useI18n()

const message = computed(() => {
  const { question } = props
  if (question.keeps) return t.value.frame.switchNetSizeMessage.replace('{count}', String(question.lost))
  if (!question.drawn) return t.value.frame.switchSettingsMessage
  return t.value.frame.switchConfirmMessage.replace('{technique}', techniqueName(t.value, question.technique)).replace('{count}', String(question.lost))
})
</script>

<template>
  <ConfirmModal
    data-testid="switch-technique-modal"
    :title="question.keeps ? t.frame.switchNetSizeTitle : t.frame.switchConfirmTitle"
    :message="message"
    :confirm-label="question.keeps ? t.frame.switchNetSizeButton : t.frame.switchConfirmButton"
    :cancel-label="t.frame.removeConfirmCancel"
    :confirm-danger="false"
    @confirm="$emit('confirm')"
    @cancel="$emit('cancel')"
  >
    <BrickBlockField v-if="question.asksBrickBlock" :model-value="question.brickBlock" testid="switch-brick-block" @update:model-value="$emit('update:brick-block', $event)" />
    <NetSizeField v-if="question.asksNetSize" :model-value="question.netSize" testid="switch-net-size" @update:model-value="$emit('update:net-size', $event)" />
  </ConfirmModal>
</template>
