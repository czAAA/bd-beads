<script setup lang="ts">
import { computed, useId } from 'vue'
import AppStepper from '../ui/form/AppStepper.vue'
import { clampNetSize, MAX_NET_SIZE, MIN_NET_SIZE } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'

/** The Net size stepper (ticket 485, Stepper card): the beads in a Netting loop, odd from 3 to 9. Shown by the New
 * Project form only, for Netting; it can't be changed once the Project is created (ADR 0038). */
defineProps<{ testid: string }>()
const value = defineModel<number>({ required: true })
// A typed even number settles on the odd one below it.
const odd = computed({ get: () => value.value, set: (size: number) => (value.value = clampNetSize(size)) })

const { t } = useI18n()
const labelId = useId()
</script>

<template>
  <div class="net-size" role="group" :aria-labelledby="labelId" :data-testid="testid">
    <span :id="labelId" class="net-size__label">{{ t.form.netSizeLabel }}</span>
    <AppStepper
      v-model="odd"
      :min="MIN_NET_SIZE"
      :max="MAX_NET_SIZE"
      :step-by="2"
      :decrease-label="t.form.netSizeLess"
      :increase-label="t.form.netSizeMore"
      :value-label="t.form.netSizeValue"
      :decrease-testid="`${testid}-less`"
      :increase-testid="`${testid}-more`"
      :value-testid="`${testid}-value`"
    />
  </div>
</template>

<style scoped>
.net-size {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  align-items: flex-start;
  font: var(--type-control);
}
</style>
