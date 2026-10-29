<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
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
  /** A cell of the margin's title block (ticket 0657): no label, the value or the empty text always with its pencil,
   * and the field floated over the sheet, since the cell is one row of text. */
  bare?: boolean
  testid: string
}>()
const emit = defineEmits<{ save: [value: string] }>()

const { t } = useI18n()
const editing = ref(false)
const draft = ref('')
const refused = ref(false)
const field = ref<InstanceType<typeof TextField>>()
const form = ref<HTMLFormElement>()
const rootEl = ref<HTMLElement>()
// Bare, the field floats above its cell in the top layer, so the margin sheet's scale (ticket 0698) never shrinks it.
const anchored = useAnchoredPosition(rootEl, form, () => 'start', () => 'above')
const fieldId = useId()
const errorId = useId()
const canSave = computed(() => !props.requiredMessage || props.normalize(draft.value) !== '')

function start() {
  draft.value = props.value
  refused.value = false
  editing.value = true
  void nextTick(() => {
    if (props.bare) anchored.follow()
    // The person tapped to type, so the keyboard rises on a touch device too (ticket 520).
    field.value?.focus({ asked: true })
  })
}

function commit() {
  const next = props.normalize(draft.value)
  if (!next && props.requiredMessage) {
    refused.value = true
    return
  }
  editing.value = false
  anchored.stop()
  if (next !== props.value) emit('save', next)
}

function cancel() {
  editing.value = false
  anchored.stop()
  refused.value = false
}

// The bare line's field floats over the margin sheet, outside any panel, so it is a layer of its own (ticket 0685):
// Escape cancels, a press outside keeps what was typed, as Save does.
useOverlayLayer({ isOpen: () => !!props.bare && editing.value, root: () => form.value, close: cancel, onOutsidePress: commit })
</script>

<template>
  <div ref="rootEl" class="editable-line" :class="{ 'editable-line--small': small, 'editable-line--bare': bare }" :data-testid="`${testid}-row`">
    <span v-if="!bare" class="editable-line__label">{{ label }}</span>
    <div v-if="!editing" class="editable-line__body">
      <template v-if="value || bare">
        <span class="editable-line__value" :class="{ 'editable-line__value--empty': !value }" :data-user-text="value ? '' : undefined" :data-testid="testid">{{ value || emptyText }}</span>
        <IconButton variant="plain" icon="pencil" :icon-size="bare ? 12 : undefined" :label="editLabel" :tooltip="{ body: editTooltip }" :data-testid="`${testid}-edit`" @click="start" />
      </template>
      <button v-else class="ui-control editable-line__empty" type="button" :data-testid="`${testid}-add`" @click="start">
        {{ emptyText }}
      </button>
    </div>
    <form
      v-else
      ref="form"
      class="editable-line__form"
      :class="{ 'anchored-popup': bare }"
      :popover="bare ? 'manual' : undefined"
      :style="bare ? anchored.style.value : undefined"
      :data-testid="`${testid}-form`"
      data-handles-escape
      @submit.prevent="commit"
      @panel-escape="cancel"
    >
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
  display: flex;
  /* The value follows its own colon by one space; label and value share a centre line. */
  align-items: center;
  gap: 1ch;
  min-width: 0;
  min-height: var(--panel-item-height);
}

.editable-line:has(.editable-line__form) {
  align-items: flex-start;
}

.editable-line:has(.editable-line__form) .editable-line__label {
  padding-top: var(--space-4);
}

.editable-line__label {
  flex: none;
  font: var(--type-label);
  color: var(--muted);
}

.editable-line__body,
.editable-line__form {
  flex: 1 1 auto;
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

.editable-line__value--empty {
  color: var(--muted);
}

/* The title block's cell (ticket 0657): one line, the pencil 18px; the field floats over the sheet above the cell, on
 * the panel's own surface. */
.editable-line--bare {
  position: relative;
  gap: var(--space-4);
  min-height: 0;
}

.editable-line--bare .editable-line__value {
  font: inherit;
  color: inherit;
}

.editable-line--bare :deep(.icon-btn) {
  width: var(--margin-pencil);
  height: var(--margin-pencil);
  color: var(--body);
}

.editable-line--bare .editable-line__form {
  z-index: var(--z-popover);
  box-sizing: border-box;
  width: var(--margin-edit-width);
  padding: var(--space-12);
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

.editable-line__error {
  margin: 0;
  font: var(--type-body);
  color: var(--danger);
}
</style>
