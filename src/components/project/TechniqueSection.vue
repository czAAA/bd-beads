<script setup lang="ts">
import { computed } from 'vue'
import { describeWeave, TECHNIQUES, type Technique } from '../../domain/weave'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import PanelPicker from '../shell/PanelPicker.vue'
import BrickBlockField from './BrickBlockField.vue'
import NetSizeField from './NetSizeField.vue'

// The Technique and its settings, shared by New Project and the Project panel (tickets 507, 554, 568): the picker, then
// the Brick block or Net size. It only reports changes: New Project binds them to its draft, the Project panel's shell
// asks before beads are lost. `disabled` (a Row progress pass is done) comes with each control's reason.
defineProps<{
  disabled?: boolean
  techniqueDisabledBody?: string
  brickBlockDisabledBody?: string
  netSizeDisabledBody?: string
  /** The prefix of the controls' test ids. */
  testid: string
}>()
const technique = defineModel<Technique>('technique', { required: true })
const brickBlock = defineModel<number>('brickBlock', { required: true })
const netSize = defineModel<number>('netSize', { required: true })

const { t } = useI18n()
const options = computed(() => TECHNIQUES.map((value) => ({ value, label: techniqueName(t.value, value) })))
const weave = computed(() => describeWeave({ technique: technique.value }))
</script>

<template>
  <div class="technique-section" data-testid="technique-section">
    <PanelPicker
      v-model="technique"
      :label="t.form.techniqueLabel"
      icon="pattern"
      :options="options"
      :disabled="disabled"
      :disabled-body="disabled ? techniqueDisabledBody : undefined"
      :data-testid="`${testid}-technique`"
    />
    <BrickBlockField
      v-if="weave.hasBrickBlock"
      v-model="brickBlock"
      :disabled="disabled"
      :disabled-body="disabled ? brickBlockDisabledBody : undefined"
      :testid="`${testid}-brick-block`"
    />
    <NetSizeField v-if="weave.hasNetSize" v-model="netSize" :testid="`${testid}-net-size`" />
  </div>
</template>

<style scoped>
.technique-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}
</style>
