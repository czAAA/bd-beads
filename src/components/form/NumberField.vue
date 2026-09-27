<script setup lang="ts">
import { computed } from 'vue'
import TextField from './TextField.vue'

/**
 * A number with its unit inside (ticket 149; NumberField card): a TextField of type number that asks for the numeric
 * keyboard on touch, `decimal` for a length in mm or cm and `numeric` for a count of beads.
 */
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ unit?: string; whole?: boolean; invalid?: boolean; disabled?: boolean }>(), {
  unit: undefined,
  whole: false,
})
const value = defineModel<string | number>()
const inputmode = computed(() => (props.whole ? 'numeric' : 'decimal'))
</script>

<template>
  <TextField v-model="value" type="number" :inputmode="inputmode" :unit="unit" :invalid="invalid" :disabled="disabled" v-bind="$attrs" />
</template>
