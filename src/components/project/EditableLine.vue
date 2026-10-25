<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'
import TextField from '../ui/form/TextField.vue'

// One line of the Project panel's head that is edited in place (ProjectPanel card): a label, the value (or a line
// inviting one) and a pencil that swaps in a TextField with Save, Cancel and a counter. Enter saves, Escape cancels. A
// `required` line refuses an empty value; an optional one clears. Saved at once, not part of Undo.
const props = defineProps<{
  label: string
  value: string
  /** The pencil's name, and the field's. */
  editLabel: string
  editTooltip?: string
  /** What an empty optional line reads: pressing it starts the edit. */
  emptyText?: string
  placeholder?: string
  maxlength: number
  /** The text that follows a refused empty value. */
  requiredMessage?: string
  /** Cuts a typed value down to what is kept; empty means nothing. */
  normalize: (raw: string) => string
  /** The smaller line (the maker's name). */
  small?: boolean
  testid: string
}>()
const emit = defineEmits<{ save: [value: string] }>()

const { t } = useI18n()
const editing = ref(false)
const draft = ref('')
const refused = ref(false)
const field = ref<InstanceType<typeof TextField>>()
const fieldId = useId()
const errorId = useId()
const canSave = computed(() => !props.requiredMessage || props.normalize(draft.value) !== '')

function start() {
  draft.value = props.value
  refused.value = false
  editing.value = true
  // The person tapped to type, so the keyboard rises on a touch device too (ticket 520).
  void nextTick(() => field.value?.focus({ asked: true }))
}

function commit() {
  const next = props.normalize(draft.value)
  if (!next && props.requiredMessage) {
    refused.value = true
    return
  }
  editing.value = false
  if (next !== props.value) emit('save', next)
}

function cancel() {
  editing.value = false
  refused.value = false
}
</script>

<template>
  <div class="editable-line" :class="{ 'editable-line--small': small }" :data-testid="`${testid}-row`">
    <span class="editable-line__label">{{ label }}</span>
    <div v-if="!editing" class="editable-line__body">
      <template v-if="value">
        <span class="editable-line__value" :data-testid="testid">{{ value }}</span>
        <IconButton variant="plain" icon="pencil" :label="editLabel" :tooltip="{ body: editTooltip }" :data-testid="`${testid}-edit`" @click="start" />
      </template>
      <button v-else class="ui-control editable-line__empty" type="button" :data-testid="`${testid}-add`" @click="start">
        {{ emptyText }}
      </button>
    </div>
    <form v-else class="editable-line__form" :data-testid="`${testid}-form`" data-handles-escape @submit.prevent="commit" @panel-escape="cancel">
      <div class="editable-line__field">
        <TextField
          :id="fieldId"
          ref="field"
          v-model="draft"
          type="text"
          :maxlength="maxlength"
          :placeholder="placeholder"
          :invalid="refused"
          :aria-label="editLabel"
          :aria-describedby="refused ? errorId : undefined"
          :data-testid="`${testid}-input`"
          @input="refused = false"
        />
        <IconButton variant="plain" icon="check" :label="t.panels.project.save" tooltip :disabled="!canSave" :data-testid="`${testid}-save`" @click="commit" />
        <IconButton variant="plain" icon="close" :label="t.panels.project.cancel" tooltip :data-testid="`${testid}-cancel`" @click="cancel" />
      </div>
      <span class="editable-line__counter">{{ draft.length }}/{{ maxlength }}</span>
      <p v-if="refused" :id="errorId" class="editable-line__error" role="alert" :data-testid="`${testid}-error`">{{ requiredMessage }}</p>
    </form>
  </div>
</template>

<style scoped>
.editable-line {
  display: grid;
  /* Lines in one grid share its label column (ProjectHead), so their values start at the same place. */
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: start;
  min-width: 0;
}

.editable-line__label {
  padding-top: var(--space-2);
  font: var(--type-label);
  color: var(--muted);
}

.editable-line__body,
.editable-line__form {
  min-width: 0;
}

.editable-line__body {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.editable-line__value {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font: var(--type-title);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editable-line--small .editable-line__value {
  font: var(--type-control);
  color: var(--body);
}

.editable-line__empty {
  padding: 0;
  font: var(--type-control);
  color: var(--muted);
  text-align: left;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.editable-line__empty::before {
  content: '+ ';
}

.editable-line__empty:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.editable-line__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.editable-line__field {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.editable-line__field > :first-child {
  flex: 1 1 auto;
  min-width: 0;
}

.editable-line__counter {
  font: var(--type-meta);
  color: var(--muted);
}

.editable-line__error {
  margin: 0;
  font: var(--type-body);
  color: var(--danger);
}
</style>
