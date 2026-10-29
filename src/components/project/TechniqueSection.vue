<script setup lang="ts">
import { computed } from 'vue'
import { settingValue } from '../../domain/settingSpec'
import { describeWeave, TECHNIQUES, type Technique, type TechniqueSettings } from '../../domain/weave'
import { weaveSettingWords } from '../../i18n/settingWords'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import PanelPicker from '../shell/PanelPicker.vue'
import SettingStepper from './SettingStepper.vue'
import { settingTestid } from './settingTestid'

// The Technique and its settings, shared by New Project and the Project panel (tickets 507, 554, 568, 0626): the picker,
// then a stepper per setting the Technique describes. It only reports changes: New Project keeps them in its draft, the
// Project panel's shell asks before beads are lost. `disabled` (a Row progress pass is done) comes with each one's reason.
const props = defineProps<{
  /** The settings' values by id; a setting with none shows its default. */
  settings: TechniqueSettings
  disabled?: boolean
  techniqueDisabledBody?: string
  /** The prefix of the controls' test ids. */
  testid: string
  /** The Techniques offered (a Custom frame's shape's, ADR 0079); every one when none are given. */
  techniques?: readonly Technique[]
}>()
const technique = defineModel<Technique>('technique', { required: true })
const emit = defineEmits<{ 'set-setting': [id: string, value: number] }>()

const { t } = useI18n()
const options = computed(() => (props.techniques ?? TECHNIQUES).map((value) => ({ value, label: techniqueName(t.value, value) })))
const steppers = computed(() =>
  describeWeave({ technique: technique.value }).settings.map((setting) => ({
    setting,
    value: settingValue(setting, props.settings[setting.id]),
    disabledBody: props.disabled ? weaveSettingWords(t.value, setting).locked : undefined,
  })),
)
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
    <SettingStepper
      v-for="{ setting, value, disabledBody } in steppers"
      :key="setting.id"
      :setting="setting"
      :model-value="value"
      :disabled="disabled"
      :disabled-body="disabledBody"
      :testid="settingTestid(testid, setting)"
      @update:model-value="emit('set-setting', setting.id, $event)"
    />
  </div>
</template>

<style scoped>
.technique-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}
</style>
