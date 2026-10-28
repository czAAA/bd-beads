<script setup lang="ts">
import { computed } from 'vue'
import ConfirmModal from '../ui/ConfirmModal.vue'
import SettingStepper from './SettingStepper.vue'
import type { SettingSpec } from '../../domain/settingSpec'
import type { Technique } from '../../domain/weave'
import { weaveSettingWords } from '../../i18n/settingWords'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import { fillBlanks } from '../../domain/fillBlanks'
import { settingTestid } from './settingTestid'

// The question before a layer's Technique or a setting of it changes (tickets 507, 568, 0626, 0641, ADR 0038): the beads
// lost, how many are Folded beads, and a stepper per setting. `changing` is a setting described as able to lose beads whose
// change, the Technique staying, asks; its words title it. The parent owns what confirming or cancelling means.
const props = defineProps<{
  question: {
    technique: Technique
    lost: number
    folded: number
    drawn: boolean
    changing?: SettingSpec
    settings: readonly { setting: SettingSpec; value: number }[]
  }
}>()
defineEmits<{ confirm: []; cancel: []; 'set-setting': [id: string, value: number] }>()

const { t } = useI18n()

/** The words of the setting change that asks, where it is one and they have its question. */
const loss = computed(() => (props.question.changing ? weaveSettingWords(t.value, props.question.changing).loss : undefined))
const message = computed(() => {
  const { lost: count, folded, drawn, technique } = props.question
  if (loss.value) return folded > 0 ? fillBlanks(loss.value.foldedMessage, { count, folded }) : fillBlanks(loss.value.message, { count })
  if (folded > 0) return fillBlanks(t.value.frame.switchConfirmFoldedMessage, { technique: techniqueName(t.value, technique), count, folded })
  if (!drawn) return t.value.frame.switchSettingsMessage
  return fillBlanks(t.value.frame.switchConfirmMessage, { technique: techniqueName(t.value, technique), count })
})
</script>

<template>
  <ConfirmModal
    data-testid="switch-technique-modal"
    :title="loss ? loss.title : t.frame.switchConfirmTitle"
    :message="message"
    :confirm-label="loss ? loss.button : t.frame.switchConfirmButton"
    :cancel-label="t.frame.removeConfirmCancel"
    :confirm-danger="false"
    @confirm="$emit('confirm')"
    @cancel="$emit('cancel')"
  >
    <SettingStepper
      v-for="{ setting, value } in question.settings"
      :key="setting.id"
      :setting="setting"
      :model-value="value"
      :testid="settingTestid('switch', setting)"
      @update:model-value="$emit('set-setting', setting.id, $event)"
    />
  </ConfirmModal>
</template>
