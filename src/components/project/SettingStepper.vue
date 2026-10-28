<script setup lang="ts">
import { computed, useId } from 'vue'
import AppTooltip from '../ui/AppTooltip.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import { settingValue, type SettingSpec } from '../../domain/settingSpec'
import { weaveSettingWords } from '../../i18n/settingWords'
import { useI18n } from '../../i18n/useI18n'

/** One Technique setting's stepper, drawn from its description (ticket 0624, ADR 0078; Stepper card): its range and
 * step, its words by its label key, and its hover text where it has one. A typed value settles on a step (an even Net
 * size on the odd one below it); `disabled` (Row progress is on) comes with the reason. */
const props = defineProps<{ setting: SettingSpec; disabled?: boolean; disabledBody?: string; testid: string }>()
const value = defineModel<number>({ required: true })
const settled = computed({ get: () => value.value, set: (next: number) => (value.value = settingValue(props.setting, next)) })

const { t } = useI18n()
const labelId = useId()
const words = computed(() => weaveSettingWords(t.value, props.setting))
/** The Tooltip over the stepper: the reason while it is locked, what it does where its words say; none otherwise. */
const tooltip = computed(() => {
  if (props.disabled && props.disabledBody !== undefined) return { name: words.value.label, disabled: true as const, disabledBody: props.disabledBody }
  return words.value.body ? { name: words.value.label, body: words.value.body } : undefined
})
const stepper = computed(() => ({
  min: props.setting.min,
  max: props.setting.max,
  stepBy: props.setting.step,
  disabled: props.disabled,
  disabledBody: props.disabledBody,
  decreaseLabel: words.value.less,
  increaseLabel: words.value.more,
  valueLabel: words.value.value,
  decreaseTestid: `${props.testid}-less`,
  increaseTestid: `${props.testid}-more`,
  valueTestid: `${props.testid}-value`,
}))
</script>

<template>
  <div class="setting-stepper" role="group" :aria-labelledby="labelId" :data-testid="testid">
    <span :id="labelId" class="setting-stepper__label">{{ words.label }}</span>
    <AppTooltip v-if="tooltip" v-bind="tooltip" placement="top" :announce="false">
      <AppStepper v-model="settled" v-bind="stepper" />
    </AppTooltip>
    <AppStepper v-else v-model="settled" v-bind="stepper" />
  </div>
</template>

<style scoped>
.setting-stepper {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  align-items: flex-start;
  font: var(--type-control);
}
</style>
