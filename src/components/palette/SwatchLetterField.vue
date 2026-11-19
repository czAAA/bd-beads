<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { fillBlanks } from '../../domain/fillBlanks'
import { TYPED_LETTER_LENGTH, typedLetter } from '../../domain/swatchLetters'
import { useI18n } from '../../i18n/useI18n'
import TextField from '../ui/form/TextField.vue'

// A swatch's letter in Edit palette (PaletteSwatches card, ticket 1092): a button under the swatch, a target of its own,
// which a press turns into a field with the letter selected. Enter or leaving it saves, Escape leaves it as it was.
const props = defineProps<{
  letter: string
  /** The color's name, for the button's and the field's names. */
  name: string
}>()
const emit = defineEmits<{ change: [letter: string] }>()

const { t } = useI18n()
const editing = ref(false)
const draft = ref('')
const rootEl = ref<HTMLElement>()
const field = ref<InstanceType<typeof TextField>>()

// Only letters are kept as they are typed, in upper case, two at most.
watch(draft, (typed) => {
  const kept = typedLetter(typed)
  if (kept !== typed) draft.value = kept
})

function start() {
  draft.value = props.letter
  editing.value = true
  // The person pressed to type, so the keyboard rises on a touch device too (ticket 520).
  void nextTick(() => field.value?.focus({ select: true, asked: true }))
}

/** Ends the edit with what was typed; nothing typed, or the letter it had, changes nothing. */
function commit() {
  if (!editing.value) return
  editing.value = false
  const next = typedLetter(draft.value)
  if (next && next !== props.letter) emit('change', next)
}

async function end(save: boolean) {
  if (save) commit()
  else editing.value = false
  await nextTick()
  rootEl.value?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
}

// While typing the field is a layer of its own: Escape ends it, not Edit palette; a press outside saves and goes on to
// what was pressed, so the next letter opens with one press.
useOverlayLayer({ isOpen: () => editing.value, root: () => rootEl.value, close: () => void end(false), outside: 'through', onOutsidePress: commit })
</script>

<template>
  <span ref="rootEl" class="swatch-letter">
    <form v-if="editing" class="swatch-letter__form" @submit.prevent="end(true)">
      <TextField
        ref="field"
        v-model="draft"
        bare
        class="swatch-letter__field"
        :maxlength="TYPED_LETTER_LENGTH"
        :aria-label="fillBlanks(t.palette.letterField, { name })"
        autocapitalize="characters"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        data-testid="swatch-letter-field"
        @blur="commit"
      />
    </form>
    <button
      v-else
      type="button"
      class="swatch-letter__button"
      :aria-label="fillBlanks(t.palette.changeLetter, { letter, name })"
      data-testid="swatch-letter"
      @click="start"
    >
      {{ letter }}
    </button>
  </span>
</template>

<style scoped>
/* The same box whether it is the button or the field, so nothing moves when a press starts the edit. */
.swatch-letter {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: var(--swatch-letter-height);
  min-height: var(--swatch-min, 0);
}

.swatch-letter__button,
.swatch-letter__form {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font: var(--type-small);
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-sm);
}

.swatch-letter__button {
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.swatch-letter__button:hover {
  border-color: var(--ink);
}

.swatch-letter__button:focus-visible,
.swatch-letter__form:focus-within {
  border-color: var(--ink);
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.swatch-letter__form :deep(.text-field),
.swatch-letter__form :deep(.text-field:focus-within) {
  background: none;
  outline: 0;
}

.swatch-letter__form :deep(.text-field__input) {
  width: 100%;
  padding: 0;
  font: inherit;
  text-align: center;
  text-transform: uppercase;
}

@media (prefers-reduced-motion: reduce) {
  .swatch-letter__button {
    transition: none;
  }
}
</style>
