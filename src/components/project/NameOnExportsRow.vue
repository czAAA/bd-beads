<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'
import { MAX_MAKER_NAME } from '../../domain/makerName'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'
import FormField from '../ui/form/FormField.vue'
import TextField from '../ui/form/TextField.vue'

// The "Name on exports" row of the Project panel (NameOnExports card, ADR 0060, ticket 443): the Maker's name printed
// on PDF and PNG exports, up to 40 characters, saved at once, not part of Undo. Unset: a field with counter and hint
// (Enter or blur saves). Set: the name and a pencil that swaps in the field; clearing it returns to unset.
const props = defineProps<{ name: string }>()
const emit = defineEmits<{ save: [name: string] }>()
const { t } = useI18n()

const draft = ref(props.name)
const editing = ref(false)
const inputId = useId()

function edit() {
  draft.value = props.name
  editing.value = true
  void nextTick(() => document.getElementById(inputId)?.focus())
}

/** Saves what is typed; a set name that was left unchanged stays as it was. */
function commit() {
  const next = draft.value.trim()
  editing.value = false
  if (next !== props.name) emit('save', next)
}
</script>

<template>
  <div class="name-row" data-testid="project-name-on-exports">
    <div v-if="name && !editing" class="name-row__set">
      <span class="name-row__label">{{ t.saveBox.nameOnExports }}</span>
      <span class="name-row__value" data-testid="name-on-exports-value">{{ name }}</span>
      <IconButton variant="plain" icon="pencil" :label="t.panels.project.editNameOnExports" tooltip data-testid="name-on-exports-change" @click="edit" />
    </div>
    <FormField v-else :label="t.saveBox.nameOnExports" :label-for="inputId" :hint="t.saveBox.nameHint">
      <template #aside>{{ draft.length }}/{{ MAX_MAKER_NAME }}</template>
      <TextField
        :id="inputId"
        :data-handles-escape="name ? '' : undefined"
        @panel-escape="draft = name; editing = false"
        v-model="draft"
        type="text"
        autocomplete="name"
        :placeholder="t.saveBox.yourName"
        :maxlength="MAX_MAKER_NAME"
        data-testid="maker-name-input"
        @keydown.enter.prevent="commit"
        @blur="commit"
      />
    </FormField>
  </div>
</template>

<style scoped>
.name-row {
  padding: var(--space-4) var(--space-12);
}

.name-row__set {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
}

.name-row__label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.name-row__value {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
  font: var(--type-control);
  font-weight: 500;
  color: var(--ink);
}
</style>
