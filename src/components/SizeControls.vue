<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { estimatedSizeMm, formatSizeMm } from '../domain/patternSize'
import { resolvePatternBead, type Pattern } from '../domain/pattern'
import { resizeRefusal, resizeRowStep, type ResizeAnchor, type ResizeRequest } from '../domain/resize'
import { useI18n } from '../i18n/useI18n'

/**
 * The body of the Size Tool group (CONTEXT.md's Estimated size and Resize, ADR 0017): the open Pattern's Estimated
 * size with its warning tooltip, and the columns and rows inputs that resize it.
 *
 * Everything is as seen on screen: the first input is the horizontal one, so rotating the Pattern swaps which of the
 * grid's two directions it drives, the same relabeling Mirror's counters get (Toolbox.vue). The request it emits is
 * in grid space, which is what App.vue and the domain speak.
 */
const props = defineProps<{ pattern: Pattern }>()

const emit = defineEmits<{
  resize: [request: ResizeRequest]
}>()

const { t } = useI18n()

type ScreenDirection = 'horizontal' | 'vertical'
type GridAxis = 'columns' | 'rows'

const DIRECTIONS: readonly ScreenDirection[] = ['horizontal', 'vertical']

function axisOf(direction: ScreenDirection): GridAxis {
  return (direction === 'horizontal') === props.pattern.rotated ? 'rows' : 'columns'
}

/** Which end each screen direction changes from — an editing-session setting, not saved with the Pattern (ticket 102). Kept per screen direction, so rotating carries each choice to the other grid axis. */
const from = ref<Record<ScreenDirection, ResizeAnchor>>({ horizontal: 'end', vertical: 'end' })

/** What each input holds while it is being edited, before it is committed on change; undefined shows the Pattern's own count. */
const drafts = ref<Record<ScreenDirection, string | undefined>>({ horizontal: undefined, vertical: undefined })

function clearDrafts() {
  drafts.value = { horizontal: undefined, vertical: undefined }
}

// A draft is about the grid it was typed against: any change to it (a Resize landing, an Undo, another Pattern) drops it.
watch(() => [props.pattern.id, props.pattern.columns, props.pattern.rows, props.pattern.rotated], clearDrafts)
watch(() => props.pattern.id, () => {
  from.value = { horizontal: 'end', vertical: 'end' }
})

function count(direction: ScreenDirection): number {
  return props.pattern[axisOf(direction)]
}

function inputValue(direction: ScreenDirection): string {
  return drafts.value[direction] ?? String(count(direction))
}

/** The size the inputs currently ask for, in grid space: the draft where there is one, else the Pattern's own count. NaN when a draft isn't a number. */
function requestedCount(direction: ScreenDirection): number {
  const draft = drafts.value[direction]
  return draft === undefined ? count(direction) : Number(draft)
}

const request = computed<ResizeRequest>(() => {
  const requested: Record<GridAxis, number> = { columns: 0, rows: 0 }
  const anchors: Record<GridAxis, ResizeAnchor> = { columns: 'end', rows: 'end' }
  for (const direction of DIRECTIONS) {
    requested[axisOf(direction)] = requestedCount(direction)
    anchors[axisOf(direction)] = from.value[direction]
  }
  return { ...requested, columnsFrom: anchors.columns, rowsFrom: anchors.rows }
})

const refusal = computed(() => resizeRefusal(props.pattern, request.value))

/** Whether the inputs are asking for something other than the Pattern's own size. */
const isEditing = computed(() => DIRECTIONS.some((direction) => drafts.value[direction] !== undefined))

const locked = computed(() => props.pattern.rowProgress.enabled)
const bead = computed(() => resolvePatternBead(props.pattern))
const unitLabels = computed(() => ({ mm: t.value.form.unitMm, cm: t.value.form.unitCm }))

/** The Estimated size, live: what the inputs ask for while it is acceptable, otherwise the Pattern's own. */
const estimate = computed(() => {
  if (!bead.value) {
    return undefined
  }
  const target = isEditing.value && !refusal.value ? request.value : props.pattern
  return formatSizeMm(
    estimatedSizeMm({ columns: target.columns, rows: target.rows, rotated: props.pattern.rotated }, bead.value),
    unitLabels.value,
  )
})

/** How much the input for this direction steps by; 2 only for the grid's rows from the start on peyote and brick stitch. */
function stepOf(direction: ScreenDirection): number {
  return axisOf(direction) === 'rows' ? resizeRowStep(props.pattern.technique, from.value[direction]) : 1
}

/** With a step of 2 the smallest allowed value must share the current count's parity, so stepping keeps landing on allowed sizes (an input steps from its `min`). */
function minOf(direction: ScreenDirection): number {
  return stepOf(direction) === 2 && count(direction) % 2 === 0 ? 2 : 1
}

const pairsHintShown = computed(() => DIRECTIONS.some((direction) => stepOf(direction) === 2))

function onInput(direction: ScreenDirection, event: Event) {
  drafts.value = { ...drafts.value, [direction]: (event.target as HTMLInputElement).value }
}

/**
 * Commits the inputs as one Resize when an edit is finished (blur, Enter, or a stepper click) rather than on every
 * keystroke, so typing "24" doesn't resize to 2 on the way — each of those would be an undo step, and shrinking one
 * drops painted cells. A refusal (not a whole number, or an odd change of rows in pairs) puts the count back.
 */
function onChange() {
  const changesSize = request.value.columns !== props.pattern.columns || request.value.rows !== props.pattern.rows
  if (!refusal.value && changesSize) {
    emit('resize', request.value)
  }
  clearDrafts()
}

function setFrom(direction: ScreenDirection, anchor: ResizeAnchor) {
  from.value = { ...from.value, [direction]: anchor }
  clearDrafts()
}

const labels: Record<ScreenDirection, () => string> = {
  horizontal: () => t.value.size.columnsLabel,
  vertical: () => t.value.size.rowsLabel,
}

const tooltipId = useId()
const tipOpen = ref(false)
</script>

<template>
  <div class="size-controls" data-testid="size-controls">
    <div v-if="estimate" class="size-controls__estimate" data-testid="size-estimate-row">
      <span
        class="size-controls__estimate-text"
        role="group"
        :aria-label="t.size.estimateLabel"
        data-testid="size-estimate"
      >
        ≈ {{ estimate }}
      </span>
      <button
        type="button"
        class="size-controls__info"
        data-testid="size-estimate-info"
        :aria-label="t.size.estimateInfoButton"
        :aria-describedby="tooltipId"
        @mouseenter="tipOpen = true"
        @mouseleave="tipOpen = false"
        @focus="tipOpen = true"
        @blur="tipOpen = false"
        @keydown.escape="tipOpen = false"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6" />
          <path d="M12 7.5v.01" />
        </svg>
      </button>
      <span
        v-show="tipOpen"
        :id="tooltipId"
        class="size-controls__tooltip"
        role="tooltip"
        data-testid="size-estimate-tooltip"
      >
        {{ t.size.estimateWarning }}
      </span>
    </div>

    <!-- The reason goes on the wrapper, not the inputs: a browser shows no tooltip for a disabled control. -->
    <div
      class="size-controls__inputs"
      :title="locked ? t.size.lockedReason : undefined"
      data-testid="size-inputs"
    >
      <div v-for="direction in DIRECTIONS" :key="direction" class="size-controls__row">
        <label :for="`size-${direction}-input`">{{ labels[direction]() }}</label>
        <input
          :id="`size-${direction}-input`"
          class="size-controls__input"
          type="number"
          inputmode="numeric"
          :data-testid="direction === 'horizontal' ? 'size-columns-input' : 'size-rows-input'"
          :min="minOf(direction)"
          :step="stepOf(direction)"
          :value="inputValue(direction)"
          :disabled="locked"
          @input="onInput(direction, $event)"
          @change="onChange"
        />
        <div
          class="size-controls__from"
          role="group"
          :aria-label="`${labels[direction]()}: ${t.size.changeFromLabel}`"
        >
          <span class="size-controls__from-label" aria-hidden="true">{{ t.size.changeFromLabel }}</span>
          <button
            v-for="anchor in ['end', 'start'] as const"
            :key="anchor"
            type="button"
            class="size-controls__from-option"
            :class="{ 'size-controls__from-option--selected': from[direction] === anchor }"
            :data-testid="`size-${direction === 'horizontal' ? 'columns' : 'rows'}-from-${anchor}`"
            :aria-pressed="from[direction] === anchor"
            :disabled="locked"
            @click="setFrom(direction, anchor)"
          >
            {{ anchor === 'end' ? t.size.fromEnd : t.size.fromStart }}
          </button>
        </div>
      </div>
    </div>

    <p v-if="pairsHintShown" class="size-controls__note" data-testid="size-pairs-hint">{{ t.size.pairsHint }}</p>
  </div>
</template>

<style scoped>
/*
 * As wide as the Tool group it sits in (a full row of ToolGroup's fixed columns — ticket 114 made the Toolbox a narrow
 * rail), so everything below wraps inside that width rather than setting one of its own: the estimate and the notes
 * wrap, and each row's label, input and "change from" choice fall onto as many lines as they need.
 */
.size-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.size-controls__estimate {
  /* A full-width row of the block above, so the tooltip anchored to it is as wide as the rail, not as wide as "≈ 1.5 × 3.0 cm". */
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.size-controls__estimate-text {
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* A small glyph, not a full icon-button: it sits in a line of text and carries the tooltip, nothing else. */
.size-controls__info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--color-ink);
  background: var(--color-orange);
  border-radius: var(--radius-pill);
}

.size-controls__info:hover:not(:disabled) {
  color: var(--color-ink);
  background: var(--color-orange);
}

.size-controls__info svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* The warning color, not an error's: this is a guide, not a fact. Opens below the estimate at the rail's width, over the controls under it — within the rail, since the rail scrolls and would clip anything wider. */
.size-controls__tooltip {
  position: absolute;
  z-index: 10;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  box-sizing: border-box;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--color-orange-ink);
  background: var(--color-orange);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
}

.size-controls__inputs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.size-controls__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.size-controls__row label {
  margin: 0;
  text-align: center;
}

.size-controls__input {
  width: 4.5em;
  padding: 4px 8px;
  font-variant-numeric: tabular-nums;
}

.size-controls__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.size-controls__from {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.size-controls__from-label {
  margin-right: 2px;
  font-size: 14px;
  opacity: 0.7;
}

/* The two "change from" choices are small pills: a setting sitting beside an input, not a control of their own. */
.size-controls__from-option {
  padding: 2px 10px;
  font-size: 14px;
}

.size-controls__from-option--selected,
.size-controls__from-option--selected:hover:not(:disabled) {
  background: var(--color-ink);
  color: var(--color-paper);
}

.size-controls__note {
  margin: 0;
  font-size: 14px;
  line-height: 1.35;
  opacity: 0.75;
}

.size-controls__note--error {
  color: var(--color-amaranth);
  font-weight: var(--font-weight-bold);
  opacity: 1;
}
</style>
