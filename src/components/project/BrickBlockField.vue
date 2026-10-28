<script setup lang="ts">
import SettingStepper from './SettingStepper.vue'
import { BRICK_BLOCK_SETTING } from '../../domain/weave'

/** The Brick block stepper (ticket 477): how many rows brick stitch weaves straight on top of each other before the
 * next rows shift. The generic setting stepper on its description (ticket 0624) until ticket 0626 draws every setting
 * from the Technique's own list; `disabled` (Row progress is on) comes with the reason. */
defineProps<{ disabled?: boolean; disabledBody?: string; testid: string }>()
const value = defineModel<number>({ required: true })
</script>

<template>
  <SettingStepper v-model="value" :setting="BRICK_BLOCK_SETTING" :disabled="disabled" :disabled-body="disabledBody" :testid="testid" />
</template>
