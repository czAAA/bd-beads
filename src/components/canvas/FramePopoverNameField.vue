<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import FieldCounter from '../ui/form/FieldCounter.vue'
import FormField from '../ui/form/FormField.vue'
import TextField from '../ui/form/TextField.vue'

// One name in the Frame popover's Names (MarginSheet card, Calmer sheet; ticket 1257): an open field that saves as the
// title block's line does, on Enter, on leaving it or as the popover closes; Escape puts the name back (ticket 0854).
const props = defineProps<{ label: string; value: string; maxlength: number; placeholder: string; testid: string }>()
const emit = defineEmits<{ save: [value: string] }>()

const { t } = useI18n()
const id = useId()
const draft = ref(props.value)
const refused = ref(false)
const edited = computed(() => draft.value !== props.value)
function putBack(): void {
  draft.value = props.value
  refused.value = false
}
watch(() => props.value, putBack)

/** A name left as it was is kept whole, even one over the limit that came in with a file; none is cut without a word. */
function commit(): void {
  if (!edited.value) return
  const next = draft.value.trim()
  refused.value = next.length > props.maxlength
  if (refused.value) return
  draft.value = next
  if (next !== props.value) emit('save', next)
}
onBeforeUnmount(commit)
</script>

<template>
  <div :data-handles-escape="edited || undefined" @panel-escape="putBack" @focusout="commit">
    <FormField :label="label" :label-for="id" :error="refused ? fillBlanks(t.fields.tooLong, { max: maxlength }) : undefined">
      <TextField
        :id="id"
        v-model="draft"
        type="text"
        autocomplete="off"
        :maxlength="maxlength"
        :placeholder="placeholder"
        :invalid="refused"
        :data-testid="testid"
        @input="refused = false"
        @keydown.enter.prevent="commit"
      />
      <template #after><FieldCounter :length="draft.length" :max="maxlength" /></template>
    </FormField>
  </div>
</template>
