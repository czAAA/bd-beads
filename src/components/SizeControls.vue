<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import AppButton from './AppButton.vue'
import { estimatedSizeMm, formatSizeMm } from '../domain/patternSize'
import { resolvePatternBead, type Pattern } from '../domain/pattern'
import { resizeRowStep, type ResizeAnchor, type ResizeRequest } from '../domain/resize'
import { useI18n } from '../i18n/useI18n'

/**
 * The body of the Size Tool group (CONTEXT.md's Estimated size and Resize, ADR 0017): the open Pattern's Estimated
 * size with its warning tooltip, and the columns and rows counters that resize it a line at a time (ticket 123
 * replaced the old typeable inputs with Mirror's axis-counter look).
 *
 * Everything is as seen on screen: the first counter is the horizontal one, so rotating the Pattern swaps which of the
 * grid's two directions it drives, the same relabeling Mirror's counters get (Toolbox.vue). The request it emits is
 * in grid space, which is what App.vue and the domain speak.
 */
const props = defineProps<{ pattern: Pattern }>()

const emit = defineEmits<{
  resize: [request: ResizeRequest]
  /** Asks App to open the Change size modal (ticket 153). */
  'change-size': []
}>()

const { t, locale } = useI18n()

type ScreenDirection = 'horizontal' | 'vertical'
type GridAxis = 'columns' | 'rows'

const DIRECTIONS: readonly ScreenDirection[] = ['horizontal', 'vertical']

function axisOf(direction: ScreenDirection): GridAxis {
  return (direction === 'horizontal') === props.pattern.rotated ? 'rows' : 'columns'
}

/** Which end each screen direction changes from — an editing-session setting, not saved with the Pattern (ticket 102). Kept per screen direction, so rotating carries each choice to the other grid axis. */
const from = ref<Record<ScreenDirection, ResizeAnchor>>({ horizontal: 'end', vertical: 'end' })

watch(() => props.pattern.id, () => {
  from.value = { horizontal: 'end', vertical: 'end' }
})

function count(direction: ScreenDirection): number {
  return props.pattern[axisOf(direction)]
}

/** How much a step of this direction's counter moves the grid by; 2 only for the grid's rows from the start on peyote and brick stitch (resizeRowStep) — a stepper button only ever moves by its own step, so it can never land on a change Resize itself would refuse for being an odd change of paired rows. */
function stepOf(direction: ScreenDirection): number {
  return axisOf(direction) === 'rows' ? resizeRowStep(props.pattern.technique, from.value[direction]) : 1
}

const locked = computed(() => props.pattern.rowProgress.enabled)
const bead = computed(() => resolvePatternBead(props.pattern))
const unitLabels = computed(() => ({ mm: t.value.form.unitMm, cm: t.value.form.unitCm }))

/** The Estimated size for the Pattern as it stands: every click already lands as its own Resize, so there is no in-progress typed value to preview against (unlike the old typeable inputs). */
const estimate = computed(() => {
  if (!bead.value) {
    return undefined
  }
  return formatSizeMm(
    estimatedSizeMm({ columns: props.pattern.columns, rows: props.pattern.rows, rotated: props.pattern.rotated }, bead.value),
    unitLabels.value,
    locale.value,
  )
})

const pairsHintShown = computed(() => DIRECTIONS.some((direction) => stepOf(direction) === 2))

/** Disabled the same way Resize itself is already refused today (ticket 123): Row progress locked, or a step down that would take the count below 1. Growing has no ceiling of its own (ADR 0019), so only the lock ever turns the + button away. */
function decreaseDisabled(direction: ScreenDirection): boolean {
  return locked.value || count(direction) - stepOf(direction) < 1
}

/** One click is one Resize, one undo step: a stepper button always asks for a size Resize will actually accept, moving this direction's own count by its own step. */
function onStep(direction: ScreenDirection, delta: 1 | -1) {
  const requested: Record<GridAxis, number> = { columns: props.pattern.columns, rows: props.pattern.rows }
  requested[axisOf(direction)] = count(direction) + delta * stepOf(direction)

  const anchors: Record<GridAxis, ResizeAnchor> = { columns: 'end', rows: 'end' }
  for (const screenDirection of DIRECTIONS) {
    anchors[axisOf(screenDirection)] = from.value[screenDirection]
  }

  emit('resize', { ...requested, columnsFrom: anchors.columns, rowsFrom: anchors.rows })
}

function setFrom(direction: ScreenDirection, anchor: ResizeAnchor) {
  from.value = { ...from.value, [direction]: anchor }
}

const labels: Record<ScreenDirection, () => string> = {
  horizontal: () => t.value.size.columnsLabel,
  vertical: () => t.value.size.rowsLabel,
}

const decreaseLabels: Record<ScreenDirection, () => string> = {
  horizontal: () => t.value.size.decreaseColumnsButton,
  vertical: () => t.value.size.decreaseRowsButton,
}

const increaseLabels: Record<ScreenDirection, () => string> = {
  horizontal: () => t.value.size.increaseColumnsButton,
  vertical: () => t.value.size.increaseRowsButton,
}

/** The screen-direction-keyed half of each testid ("columns"/"rows"), independent of which grid axis it currently drives (rotating swaps that, not this). */
function testIdAxis(direction: ScreenDirection): 'columns' | 'rows' {
  return direction === 'horizontal' ? 'columns' : 'rows'
}

const lockedNoteId = useId()
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

    <!-- The reason goes on the wrapper, not the counters: a browser shows no tooltip for a disabled control. -->
    <div
      class="size-controls__inputs"
      :title="locked ? t.size.lockedReason : undefined"
      data-testid="size-inputs"
    >
      <div v-for="direction in DIRECTIONS" :key="direction" class="size-controls__row">
        <p
          class="size-controls__counter"
          role="group"
          :aria-label="labels[direction]()"
          :data-testid="`size-${testIdAxis(direction)}`"
        >
          <AppButton
            variant="toolbox"
            size="sm"
            :data-testid="`size-${testIdAxis(direction)}-decrease`"
            :title="decreaseLabels[direction]()"
            :aria-label="decreaseLabels[direction]()"
            :disabled="decreaseDisabled(direction)"
            @click="onStep(direction, -1)"
          >
            −
          </AppButton>
          <span class="size-controls__counter-label" :data-testid="`size-${testIdAxis(direction)}-value`">
            {{ labels[direction]() }}: {{ count(direction) }}
          </span>
          <AppButton
            variant="toolbox"
            size="sm"
            :data-testid="`size-${testIdAxis(direction)}-increase`"
            :title="increaseLabels[direction]()"
            :aria-label="increaseLabels[direction]()"
            :disabled="locked"
            @click="onStep(direction, 1)"
          >
            +
          </AppButton>
        </p>
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
            :data-testid="`size-${testIdAxis(direction)}-from-${anchor}`"
            :aria-pressed="from[direction] === anchor"
            :disabled="locked"
            @click="setFrom(direction, anchor)"
          >
            {{ anchor === 'end' ? t.size.fromEnd : t.size.fromStart }}
          </button>
        </div>
      </div>
    </div>

    <!--
      Kept focusable while Row progress is on (aria-disabled, not disabled) so the reason can be reached from the
      keyboard too: it is on the button's title and read out as its description, and shown below.
    -->
    <button
      type="button"
      class="size-controls__change"
      data-testid="size-change-size"
      :aria-disabled="locked"
      :aria-describedby="locked ? lockedNoteId : undefined"
      :title="locked ? t.size.lockedReason : undefined"
      @click="locked || emit('change-size')"
    >
      {{ t.changeSize.button }}
    </button>
    <p v-if="locked" :id="lockedNoteId" class="size-controls__note" data-testid="size-change-size-locked">
      {{ t.size.lockedReason }}
    </p>

    <p v-if="pairsHintShown" class="size-controls__note" data-testid="size-pairs-hint">{{ t.size.pairsHint }}</p>
  </div>
</template>

<style scoped>
/*
 * As wide as the Tool group it sits in (a full row of ToolGroup's fixed columns — ticket 114 made the Toolbox a narrow
 * rail), so everything below wraps inside that width rather than setting one of its own: the estimate and the notes
 * wrap, and each row's counter and "change from" choice fall onto as many lines as they need.
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
  font-weight: 700;
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
  color: var(--ink);
  background: var(--warning);
  border: 0;
  border-radius: var(--radius-full);
}

.size-controls__info:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
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
  color: var(--ink);
  background: var(--warning);
  border: 1px solid var(--ink);
  border-radius: var(--radius-md);
}

.size-controls__inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.size-controls__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

/*
 * The columns/rows counter (ticket 123): decrease / label / increase, matching Mirror's axis-counter look
 * (Toolbox.vue's .mirror-axis-counter) — the rail is too narrow for all three side by side, so the label takes the
 * row's first line and the two buttons share the one beneath it (`order` moves only what is seen, so reading and Tab
 * order stay decrease, label, increase).
 */
.size-controls__counter {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
}

.size-controls__counter-label {
  order: -1;
  flex: 1 1 100%;
  min-width: 0;
  font-variant-numeric: tabular-nums;
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

/* The two "change from" choices are small pills: a setting sitting beside the counter, not a control of their own. */
.size-controls__from-option {
  padding: 2px 10px;
  font-size: 14px;
  color: var(--body);
  background: var(--elevated);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.size-controls__from-option:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.size-controls__from-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.size-controls__from-option--selected,
.size-controls__from-option--selected:hover:not(:disabled) {
  color: var(--canvas);
  background: var(--ink);
  border-color: var(--ink);
}

/*
 * The design system's `toolbox` AppButton look, hand-drawn: this button stays reachable while Row progress locks it
 * (aria-disabled, not disabled), which AppButton's own `disabled` prop can't do (BeadQuantities and the reason under
 * it need it focusable).
 */
.size-controls__change {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  height: var(--control-height);
  padding: 0 var(--space-12);
  box-sizing: border-box;
  font: var(--type-control);
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-md);
  cursor: pointer;
}

:root[data-theme='dark'] .size-controls__change {
  border-color: var(--elevated);
}

@media (hover: hover) {
  .size-controls__change:hover[aria-disabled='false'] {
    background: var(--elevated);
    border-color: var(--ink);
  }
}

.size-controls__change:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.size-controls__change[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}

.size-controls__note {
  margin: 0;
  font-size: 14px;
  line-height: 1.35;
  opacity: 0.75;
}

.size-controls__note--error {
  color: var(--danger);
  font-weight: 700;
  opacity: 1;
}
</style>
