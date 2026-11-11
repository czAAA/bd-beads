<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import TextField from '../ui/form/TextField.vue'

// Go to row (ProgressBar card, ticket 0849, F-04-14): hung above the Progress bar's counter, a field for the row the
// weaver is on, "Row [12] of 40", and Go; Enter goes too. Escape or a press outside closes it and nothing moves.
const props = defineProps<{
  /** The counter it hangs from: its own press toggles the popover. */
  anchor: HTMLElement | undefined
  /** Its name: Go to row, or Go to column. */
  title: string
  /** What the number counts: Row, Column, or Pass where a line takes two (peyote). */
  unit: string
  /** The row shown as current, from 1, and how many there are. */
  current: number
  total: number
}>()
const emit = defineEmits<{
  close: []
  /** The pass to go to, from 0. */
  go: [pass: number]
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement>()
const anchorEl = ref<HTMLElement>()
const field = useTemplateRef<InstanceType<typeof TextField>>('field')
const anchored = useAnchoredPosition(anchorEl, rootEl, () => 'start', () => 'above')
const draft = ref(String(props.current))

/** The number typed, whole and from 1 to the total; none for anything else, which Go refuses. */
const typed = computed(() => {
  const text = draft.value.trim()
  const number = /^\d+$/.test(text) ? Number(text) : NaN
  return number >= 1 && number <= props.total ? number : undefined
})

function close() {
  emit('close')
  props.anchor?.focus({ preventScroll: true })
}

useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close,
  onOutsidePress: () => emit('close'),
  isOpener: (target) => props.anchor?.contains(target) ?? false,
})

function go() {
  if (typed.value === undefined) return
  emit('go', typed.value - 1)
  close()
}

onMounted(async () => {
  anchorEl.value = props.anchor
  await nextTick()
  anchored.follow()
  // A press on the counter opened it to type, so the keyboard rises on touch too (ticket 518).
  field.value?.focus({ select: true, asked: true })
})
</script>

<template>
  <div ref="rootEl" class="go-to-row anchored-popup" popover="manual" :style="anchored.style.value" role="dialog" :aria-label="title" data-testid="go-to-row">
    <span class="go-to-row__title">{{ title }}</span>
    <form class="go-to-row__form" novalidate @submit.prevent="go">
      <label class="go-to-row__line">
        <span>{{ unit }}</span>
        <TextField
          ref="field"
          v-model="draft"
          class="go-to-row__field"
          compact
          select-on-focus
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          :invalid="typed === undefined"
          data-testid="go-to-row-field"
        />
        <span class="go-to-row__of">{{ fillBlanks(t.rowProgress.ofSteps, { total }) }}</span>
      </label>
      <AppButton variant="primary" size="sm" type="submit" :disabled="typed === undefined" data-testid="go-to-row-go">{{ t.rowProgress.goButton }}</AppButton>
    </form>
  </div>
</template>

<style scoped>
/* The shared popover look (MarginSheet card's Margin color popover): 12px padding, the overlay fill and line, elevation 3. */
.go-to-row {
  position: fixed;
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  box-sizing: border-box;
  padding: var(--space-12);
  pointer-events: auto;
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

.go-to-row__title {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.go-to-row__form {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  margin: 0;
}

.go-to-row__line {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
}

.go-to-row__field {
  width: var(--go-to-row-field);
}

.go-to-row__of {
  font: var(--type-meta);
  color: var(--box-muted);
}
</style>
