<script setup lang="ts">
import { onMounted, ref } from 'vue'
import RowDirectionPopover from '../components/canvas/RowDirectionPopover.vue'

// The Row progress counter's list open on its button, with no strip beside it, for the text fit cases (ticket 1223): the
// strip's own Tooltips would be closed by the press that opens the list.
withDefaults(defineProps<{ turns?: boolean }>(), { turns: true })
const anchor = ref<HTMLElement>()
const open = ref(false)
onMounted(() => (open.value = true))
</script>

<template>
  <button ref="anchor" type="button" style="margin: 12px 8px 220px">Row 1 of 20</button>
  <RowDirectionPopover v-if="open && anchor" :anchor="anchor" current="down" :turns="turns" :row-highlight="true" :can-reset="true" testid="list" />
</template>
