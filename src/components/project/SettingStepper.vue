<script setup lang="ts">
import { computed, useId } from 'vue'
import AppTooltip from '../ui/AppTooltip.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import InfoButton from '../ui/InfoButton.vue'
import { settingValue, type SettingSpec } from '../../domain/settingSpec'
import { weaveSettingWords } from '../../i18n/settingWords'
import { useI18n } from '../../i18n/useI18n'

/** One Technique setting's stepper, drawn from its description (ticket 0624, ADR 0078; Stepper card): range, step,
 * words by its label key, an Info button with its help where they have one (ticket 0844). A typed value settles on a
 * step (an even Net size on the odd one below it); `disabled` (Row progress is on) comes with the reason. */
const props = defineProps<{ setting: SettingSpec; disabled?: boolean; disabledBody?: string; testid: string }>()
const value = defineModel<number>({ required: true })
const settled = computed({ get: () => value.value, set: (next: number) => (value.value = settingValue(props.setting, next)) })

const { t } = useI18n()
const labelId = useId()
const words = computed(() => weaveSettingWords(t.value, props.setting))
/** The Tooltip over the stepper: the reason while it is locked; none otherwise, its help being the Info button's. */
const tooltip = computed(() =>
  props.disabled && props.disabledBody !== undefined ? { name: words.value.label, disabled: true as const, disabledBody: props.disabledBody } : undefined,
)
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
    <span class="setting-stepper__head">
      <span :id="labelId">{{ words.label }}</span>
      <InfoButton v-if="words.body" :label="words.infoLabel ?? words.label" :body="words.body" :data-testid="`${testid}-info`" />
    </span>
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

.setting-stepper__head {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
}
</style>
