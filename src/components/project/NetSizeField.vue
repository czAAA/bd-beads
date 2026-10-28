<script setup lang="ts">
import SettingStepper from './SettingStepper.vue'
import { NET_SIZE_SETTING } from '../../domain/weave'

/** The Net size stepper (ticket 485): the beads in a Netting loop, odd from 3 to 9. The generic setting stepper on its
 * description (ticket 0624) until ticket 0626 draws every setting from the Technique's own list. */
defineProps<{ testid: string }>()
const value = defineModel<number>({ required: true })
</script>

<template>
  <SettingStepper v-model="value" :setting="NET_SIZE_SETTING" :testid="testid" />
</template>
