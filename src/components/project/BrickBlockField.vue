<script setup lang="ts">
import { computed, useId } from 'vue'
import AppTooltip from '../ui/AppTooltip.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import { MAX_BRICK_BLOCK } from '../../domain/weave'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'

/** The Brick block stepper (ticket 477, Stepper card): how many rows brick stitch weaves straight on top of each other
 * before the next rows shift. Shown by the new-project form and the Frame menu, only for Brick stitch; `disabled`
 * (Row progress is on) comes with the reason. */
defineProps<{ disabled?: boolean; disabledBody?: string; testid: string }>()
const value = defineModel<number>({ required: true })

const { t } = useI18n()
const labelId = useId()
const action = controlAction('change-brick-block')
const body = computed(() => action.body?.(t.value))
</script>

<template>
  <div class="brick-block" role="group" :aria-labelledby="labelId" :data-testid="testid">
    <span :id="labelId" class="brick-block__label">{{ t.form.brickBlockLabel }}</span>
    <AppTooltip
      v-bind="disabled && disabledBody !== undefined ? { name: t.form.brickBlockLabel, disabled: true as const, disabledBody } : { name: t.form.brickBlockLabel, body }"
      placement="top"
      :announce="false"
    >
      <AppStepper
        v-model="value"
        :min="1"
        :max="MAX_BRICK_BLOCK"
        :disabled="disabled"
        :disabled-body="disabledBody"
        :decrease-label="t.form.brickBlockLess"
        :increase-label="t.form.brickBlockMore"
        :value-label="t.form.brickBlockValue"
        :decrease-testid="`${testid}-less`"
        :increase-testid="`${testid}-more`"
        :value-testid="`${testid}-value`"
      />
    </AppTooltip>
  </div>
</template>

<style scoped>
.brick-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  align-items: flex-start;
  font: var(--type-control);
}
</style>
