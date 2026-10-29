<script setup lang="ts">
import { computed } from 'vue'
import { frameRowOrder, rowProgressPosition } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { orderStepLabel } from '../../i18n/orderStep'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import IconButton from '../ui/IconButton.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// Row progress's controls (ProgressBar and MarginSheet cards; tickets 144, 411, 0657, 0658): one component in the
// Progress bar and the margin sheet's top band, so a press in either moves the one pointer the Project carries. `bar`
// spells the row out; on the margin, `margin` is the full form, `compact` and `folded` its smaller ones.
const props = withDefaults(defineProps<{
  project: Project
  /** Whether the Canvas draws the Row progress look (ticket 474): the Switch is on while it does. */
  rowHighlight?: boolean
  form: 'bar' | 'margin' | 'compact' | 'folded'
  /** The prefix of the controls' test ids, so the two places can be told apart. */
  testid: string
}>(), { rowHighlight: true })

const emit = defineEmits<{
  'move-row': [delta: number]
  /** Reset progress, which asks first (ticket 455); it is only enabled once a row is done. */
  'reset-progress': []
  'toggle-row-direction': []
  'toggle-row-highlight': []
}>()

const { t } = useI18n()

/** Every control here is a registry action: its name, Tooltip, key chip and disabled reason come from there (ADR
 * 0035). */
const actions = {
  reset: controlAction('reset-progress'),
  direction: controlAction('row-direction'),
  rowHighlight: controlAction('row-highlight'),
  notDone: controlAction('row-not-done'),
  done: controlAction('row-done'),
}
const deps = computed(() => controlDeps({ activeProject: () => props.project }))

const position = computed(() => rowProgressPosition(props.project))

/** Rows before the current one are finished. */
const finishedShare = computed(() => (position.value.total > 0 ? position.value.current / position.value.total : 0))

const columnWise = computed(() => props.project.rowProgress.direction === 'columns')

/** Row done and Row not done name what is woven in the direction the rows run: a row, or a column (ticket 411). */
const doneLabel = computed(() => (columnWise.value ? t.value.rowProgress.columnNextButton : t.value.rowProgress.nextButton))
const notDoneLabel = computed(() => (columnWise.value ? t.value.rowProgress.columnPreviousButton : t.value.rowProgress.previousButton))

/** The row shown as current: the last one once every pass is done. */
const shownRow = computed(() => Math.min(position.value.current + 1, position.value.total))

/** A Custom frame's pass in words in place of "Row 3 of 20 · Top to bottom" (ticket 0594): "Round 3 of 9", or where
 * its passes are of several sorts, parts, joins or a Fringe earring's strands, "Part 2, round 3 · 8 of 20". None for a
 * Frame without a Frame shape. */
const customPosition = computed(() => {
  const order = frameRowOrder(props.project)
  const step = order.stepOf?.(shownRow.value - 1)
  if (!step) return undefined
  const words = t.value.rowProgress
  // The last pass is a join or a strand wherever the passes are not all rounds or rows of one part.
  const last = order.stepOf!(order.count - 1)!
  const single = last.kind !== 'join' && last.kind !== 'strand' && last.part === undefined
  const total = position.value.total
  const of = single ? fillBlanks(words.ofSteps, { total }) : fillBlanks(words.stepOfSteps, { current: shownRow.value, total })
  return { label: orderStepLabel(words, step), of }
})

const directionLabel = computed(() => {
  const { direction, reversed } = props.project.rowProgress
  const words = t.value.rowProgress
  if (direction === 'rows') return reversed ? words.bottomToTop : words.topToBottom
  return reversed ? words.rightToLeft : words.leftToRight
})

/** The turn that points the down arrow along the rows: the arrows are drawn for top to bottom (ticket 0589). */
const arrowTurn = computed(() => {
  const { direction, reversed } = props.project.rowProgress
  return direction === 'rows' ? (reversed ? 'up' : 'down') : reversed ? 'left' : 'right'
})

type Item = 'direction' | 'highlight' | 'reset' | 'position' | 'counter' | 'track' | 'divider' | 'steps'
/** The bar's order (ProgressBar card), and the margin's, which puts Reset beside Turn row direction and sets the
 * counter off with dividers, then its smaller forms (MarginSheet card, Zoom forms). */
const ITEMS: Record<typeof props.form, readonly Item[]> = {
  bar: ['direction', 'highlight', 'reset', 'position', 'counter', 'track', 'steps'],
  margin: ['direction', 'reset', 'highlight', 'divider', 'counter', 'track', 'divider', 'steps'],
  compact: ['counter', 'track', 'steps'],
  folded: ['counter', 'steps'],
}
const items = computed(() => ITEMS[props.form])
const margin = computed(() => props.form !== 'bar')
/** The smaller forms keep Row done alone: Row not done is the Progress bar's there. */
const small = computed(() => props.form === 'compact' || props.form === 'folded')
</script>

<template>
  <div class="row-progress" :class="[`row-progress--${form}`, { 'row-progress--margin': margin, 'row-progress--small': small }]" :data-testid="margin ? testid : undefined">
  <template v-for="(item, index) in items" :key="`${item}-${index}`">
    <!-- Turn row direction and Reset progress sit away from the do/undo pair, so they can't be hit while doing rows (tickets 411, 455). -->
    <IconButton
      v-if="item === 'direction' && frameRowOrder(project).turns"
      :variant="margin ? 'plain' : 'box'"
      :action="actions.direction"
      :selected="columnWise"
      :data-testid="`${testid}-direction`"
      @click="emit('toggle-row-direction')"
    />
    <!-- Row highlight is a view switch, not an action on the Project: an on/off Switch (ticket 474); the parent owns the value and flips it. -->
    <AppSwitch
      v-else-if="item === 'highlight'"
      :model-value="rowHighlight"
      :action="actions.rowHighlight"
      :data-testid="`${testid}-highlight`"
      @update:model-value="emit('toggle-row-highlight')"
    />
    <IconButton
      v-else-if="item === 'reset'"
      :variant="margin ? 'plain' : 'box'"
      :action="actions.reset"
      :deps="deps"
      :data-testid="`${testid}-reset`"
      @click="emit('reset-progress')"
    />
    <p v-else-if="item === 'position'" class="row-progress__position row-progress__phone-hide" :data-testid="`${testid}-position`">
      <span class="row-progress__row">{{ customPosition?.label ?? `${t.rowProgress.positionLabel} ${shownRow}` }}</span>
      {{ ' ' }}
      <span class="row-progress__of">{{
        customPosition?.of ?? fillBlanks(t.rowProgress.ofTotal, { total: position.total, direction: directionLabel })
      }}</span>
    </p>
    <!-- The compact counter (ticket 188): "1/222" in place of the spelled-out row count; the buttons keep their text (ticket 411). -->
    <p v-else-if="item === 'counter'" class="row-progress__counter" :data-testid="`${testid}-compact-position`">
      {{ shownRow }}/{{ position.total }}
    </p>
    <div
      v-else-if="item === 'track'"
      class="row-progress__track"
      :class="{ 'row-progress__track--margin': margin }"
      role="progressbar"
      :aria-label="t.rowProgress.finishedLabel"
      aria-valuemin="0"
      :aria-valuemax="position.total"
      :aria-valuenow="position.current"
      :data-testid="`${testid}-track`"
    >
      <span class="row-progress__fill" :style="{ width: `${finishedShare * 100}%` }" />
    </div>
    <span v-else-if="item === 'divider'" class="row-progress__divider" aria-hidden="true" />
    <!-- Row not done and Row done follow Row direction with their label and arrow (ticket 411); on the margin Row not
      done is its arrow alone, named by the label, and the smaller forms leave it to the Progress bar. -->
    <div v-else-if="item === 'steps'" class="row-progress__steps" :class="[`row-progress__steps--${arrowTurn}`, { 'row-progress__steps--margin': margin }]">
      <IconButton
        v-if="margin && !small"
        variant="plain"
        :action="actions.notDone"
        :label="notDoneLabel"
        icon="arrow-up"
        :disabled="position.current === 0"
        :data-testid="`${testid}-previous`"
        @click="emit('move-row', -1)"
      />
      <AppButton
        v-else-if="!margin"
        variant="box"
        size="lg"
        :action="actions.notDone"
        :label="notDoneLabel"
        icon="arrow-up"
        :disabled="position.current === 0"
        :data-testid="`${testid}-previous`"
        @click="emit('move-row', -1)"
      />
      <AppButton
        variant="primary"
        :size="margin ? 'sm' : 'lg'"
        :action="actions.done"
        :label="doneLabel"
        trailing-icon="arrow-down"
        :disabled="position.current >= position.total"
        :data-testid="`${testid}-next`"
        @click="emit('move-row', 1)"
      />
    </div>
  </template>
  </div>
</template>

<style scoped>
/* In the bar its controls are the bar's own flex items; on the margin they are one row, 4px apart. */
.row-progress--bar {
  display: contents;
}

.row-progress--margin {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.row-progress__position {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
  margin: 0 0 0 var(--space-2);
  white-space: nowrap;
}

.row-progress__row {
  font: var(--type-control);
  color: var(--ink);
}

.row-progress__of {
  font: var(--type-meta);
  color: var(--box-muted);
  text-transform: lowercase;
}

.row-progress__counter {
  margin: 0 0 0 var(--space-2);
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
}

/* The wide row count stays out of the bar: the short counter stands in for it at every width (ticket 188, 295; ADR
 * 0046). */
.row-progress__phone-hide {
  display: none;
}

/* Row not done and Row done (ticket 411): large text buttons, set well apart from Turn row direction. */
.row-progress__steps {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
}

.row-progress__steps--margin {
  gap: var(--space-4);
}

/* The arrows point along the rows: drawn for top to bottom, the down arrow turns to point right, up or left. */
.row-progress__steps--right :deep(svg) {
  transform: rotate(-90deg);
}

.row-progress__steps--up :deep(svg) {
  transform: rotate(180deg);
}

.row-progress__steps--left :deep(svg) {
  transform: rotate(90deg);
}

.row-progress__track {
  flex: 1 1 auto;
  min-width: var(--space-32);
  height: var(--track-height);
  overflow: hidden;
  background: var(--track);
  border-radius: var(--radius-full);
}

/* On the margin the track is 64px (MarginSheet card). */
.row-progress__track--margin {
  flex: none;
  width: var(--margin-track);
}

.row-progress__fill {
  display: block;
  height: 100%;
  background: var(--track-fill);
  border-radius: inherit;
  transition: width var(--duration-base) var(--ease-standard);
}

/* A 1px rule between the switch, the counter and the steps (MarginSheet card). */
.row-progress__divider {
  flex: none;
  width: 1px;
  height: var(--space-16);
  margin: 0 var(--space-2);
  background: var(--margin-line);
}

/* The margin's tools: 28px, no fill, hover ink at 10% (MarginSheet card); Row done is the bar's primary at 26px. */
.row-progress--margin :deep(.icon-btn) {
  width: var(--margin-tool);
  height: var(--margin-tool);
  border-radius: var(--radius-md);
}

.row-progress--margin :deep(.icon-btn:hover) {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}

.row-progress--margin :deep(.app-switch-wrap) {
  margin: 0 var(--space-4);
}

.row-progress--margin :deep(.app-button) {
  height: var(--margin-done);
}

/* The compact and folded forms: Row done 22px in the small type, the track 40px (MarginSheet card, Zoom forms). */
.row-progress--small :deep(.app-button) {
  height: var(--margin-done-compact);
  padding: 0 var(--space-6) 0 var(--space-8);
  gap: var(--space-4);
  font: var(--type-small);
}

.row-progress--small .row-progress__track--margin {
  width: var(--margin-track-compact);
}

/* Phone widths (ticket 411): the bar's large buttons can't share a row with Turn row direction and the track at 360px
 * in every language, so they take a second row, half the bar each (the bar wraps). */
@media (max-width: 30rem) {
  .row-progress--bar .row-progress__track {
    min-width: var(--space-32);
  }

  .row-progress--bar .row-progress__steps {
    flex: 1 1 100%;
    min-width: 0;
    gap: var(--space-4);
  }

  /* A button is wrapped (for its Tooltip) only while it has one, so a lone button is a flex item too. */
  .row-progress--bar .row-progress__steps > .app-button,
  .row-progress--bar .row-progress__steps :deep(.app-button-wrap) {
    flex: 1 1 0;
    min-width: 0;
  }

  .row-progress--bar .row-progress__steps :deep(.app-button) {
    width: 100%;
    min-width: 0;
    padding-inline: var(--space-6);
    gap: var(--space-2);
    justify-content: center;
    font: var(--type-small);
  }
}

@media (prefers-reduced-motion: reduce) {
  .row-progress__fill {
    transition: none;
  }
}
</style>
