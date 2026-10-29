<script setup lang="ts">
import { computed, ref } from 'vue'
import { frameRowOrder, rowProgressPosition, shownWay } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { orderStepLabel } from '../../i18n/orderStep'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import IconButton from '../ui/IconButton.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// Progress bar (CONTEXT.md; tickets 144, 411, 426, ProgressBar card): every Row progress control, in one bar along the
// canvas box's bottom. On whenever there is a Frame (ADR 0055); without one it offers Fit to drawing. With a Frame:
// Turn row direction, Row highlight, Reset, current row, Row not done / done, moving the pointer like the hotkeys.
const props = withDefaults(defineProps<{
  project: Project
  /** Whether the Canvas draws the Row progress look (ticket 474): pressed while it does. */
  rowHighlight?: boolean
}>(), { rowHighlight: true })

const emit = defineEmits<{
  'move-row': [delta: number]
  /** Reset progress, which asks first (ticket 455); it is only enabled once a row is done. */
  'reset-progress': []
  'toggle-row-direction': []
  'toggle-row-highlight': []
  /** The bar's own way to a Frame, shown while there is none to count rows on: Fit to drawing. */
  'fit-frame': []
}>()

const { t } = useI18n()

// One Tab stop; ←/→ step along the bar's controls and stop at the ends (ADR 0075).
const rootEl = ref<HTMLElement>()
const roving = useRovingFocus(rootEl, { axis: () => 'horizontal', managesTabIndex: true })

/** Every control here is a registry action: its name, Tooltip, key chip and disabled reason come from there (ADR
 * 0035). */
const actions = {
  reset: controlAction('reset-progress'),
  fitFrame: controlAction('fit-to-drawing'),
  direction: controlAction('row-direction'),
  rowHighlight: controlAction('row-highlight'),
  notDone: controlAction('row-not-done'),
  done: controlAction('row-done'),
}
const deps = computed(() => controlDeps({ activeProject: () => props.project }))

/** Row progress works on the Frame's rows, so with no Frame the bar can only ask for one. */
const hasFrame = computed(() => props.project.frame !== undefined)

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

/** The turn that points the down arrow along the rows: the arrows are drawn for top to bottom (ticket 0589). A turned
 * Frame's rows run turned with it (ticket 0667). */
const arrowTurn = computed(() => shownWay(props.project.rowProgress, props.project.frame?.quarterTurns))

const directionLabel = computed(() => {
  const words = t.value.rowProgress
  const labels = { down: words.topToBottom, up: words.bottomToTop, right: words.leftToRight, left: words.rightToLeft }
  return labels[arrowTurn.value]
})
</script>

<template>
  <div ref="rootEl" class="progress-bar no-page-pan" data-testid="progress-bar" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
    <template v-if="!hasFrame">
      <!-- Styled like the CanvasHint, icons 14px to fit the 20px chips: "(Select chip) Select to set a (Frame chip) Frame", each icon in a chip. -->
      <p class="progress-bar__need" data-testid="progress-bar-needs-frame">
        <span class="hint-chip"><AppIcon name="select" :size="14" /></span>
        {{ t.frame.progressSelectToSet }}
        <span class="hint-chip"><AppIcon name="frame" :size="14" /></span>
        {{ t.frame.progressFrameWord }}
      </p>
      <span class="progress-bar__fit-frame">
        <AppButton variant="box" :action="actions.fitFrame" :deps="deps" data-testid="progress-bar-fit-frame" @click="emit('fit-frame')" />
      </span>
    </template>
    <template v-else>
      <!-- Turn row direction and Reset progress sit away from the do/undo pair, so they can't be hit while doing rows (tickets 411, 455). -->
      <IconButton
        v-if="frameRowOrder(project).turns"
        variant="box"
        :action="actions.direction"
        :selected="columnWise"
        data-testid="progress-bar-direction"
        @click="emit('toggle-row-direction')"
      />
      <!-- Row highlight is a view switch, not an action on the Project: an on/off Switch (ticket 474); the parent owns the value and flips it. -->
      <AppSwitch
        :model-value="rowHighlight"
        :action="actions.rowHighlight"
        data-testid="progress-bar-highlight"
        @update:model-value="emit('toggle-row-highlight')"
      />
      <IconButton
        variant="box"
        :action="actions.reset"
        :deps="deps"
        data-testid="progress-bar-reset"
        @click="emit('reset-progress')"
      />
      <p class="progress-bar__position progress-bar__phone-hide" data-testid="progress-bar-position">
        <span class="progress-bar__row">{{ customPosition?.label ?? `${t.rowProgress.positionLabel} ${shownRow}` }}</span>
        {{ ' ' }}
        <span class="progress-bar__of">{{
          customPosition?.of ?? fillBlanks(t.rowProgress.ofTotal, { total: position.total, direction: directionLabel })
        }}</span>
      </p>
      <!-- The compact counter (ticket 188): "1/222" in place of the spelled-out row count; the buttons keep their text (ticket 411). -->
      <p class="progress-bar__compact-position" data-testid="progress-bar-compact-position">
        {{ shownRow }}/{{ position.total }}
      </p>
      <div
        class="progress-bar__track"
        role="progressbar"
        :aria-label="t.rowProgress.finishedLabel"
        aria-valuemin="0"
        :aria-valuemax="position.total"
        :aria-valuenow="position.current"
        data-testid="progress-bar-track"
      >
        <span class="progress-bar__fill" :style="{ width: `${finishedShare * 100}%` }" />
      </div>
      <!-- Row not done and Row done are large text buttons whose label and arrow follow Row direction (ticket 411). -->
      <div class="progress-bar__steps" :class="`progress-bar__steps--${arrowTurn}`">
        <AppButton
          variant="box"
          size="lg"
          :action="actions.notDone"
          :label="notDoneLabel"
          icon="arrow-up"
          :disabled="position.current === 0"
          data-testid="progress-bar-previous"
          @click="emit('move-row', -1)"
        />
        <AppButton
          variant="primary"
          size="lg"
          :action="actions.done"
          :label="doneLabel"
          trailing-icon="arrow-down"
          :disabled="position.current >= position.total"
          data-testid="progress-bar-next"
          @click="emit('move-row', 1)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
/* No Frame (ProgressBar card): "Select to set a Frame" set like the CanvasHint, and the Fit to drawing button pushed
 * to the right. */
.progress-bar__need {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin: 0;
  font: 400 0.75rem/1rem var(--font-sans);
  color: var(--muted);
  white-space: nowrap;
}

.progress-bar__fit-frame {
  margin-left: auto;
}

.progress-bar {
  container-type: inline-size;
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-12);
  box-sizing: border-box;
  /* As tall as its tallest item plus 1px above and below (ticket 544); --progress-height is the same rule for the
   * Homepage's empty footer. The bottom corners follow the canvas box's curve. */
  min-height: var(--progress-height);
  padding: var(--bar-pad) var(--space-12) var(--bar-pad) var(--space-16);
  border: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
  border-bottom: 0;
  border-radius: 0 0 var(--canvas-box-radius) var(--canvas-box-radius);
}

.progress-bar__position {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
  margin: 0 0 0 var(--space-2);
  white-space: nowrap;
}

.progress-bar__row {
  font: var(--type-control);
  color: var(--ink);
}

.progress-bar__of {
  font: var(--type-meta);
  color: var(--box-muted);
  text-transform: lowercase;
}

.progress-bar__compact-position {
  margin: 0 0 0 var(--space-2);
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
}

/* The wide row count stays out of the bar: the short counter stands in for it at every width (ticket 188, 295; ADR
 * 0046). */
.progress-bar__phone-hide {
  display: none;
}

/* Row not done and Row done (ticket 411): large text buttons, set well apart from Turn row direction beside Remove
 * frame. */
.progress-bar__steps {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
}

/* The arrows point along the rows: drawn for top to bottom, the down arrow turns to point right, up or left. */
.progress-bar__steps--right :deep(svg) {
  transform: rotate(-90deg);
}

.progress-bar__steps--up :deep(svg) {
  transform: rotate(180deg);
}

.progress-bar__steps--left :deep(svg) {
  transform: rotate(90deg);
}

.progress-bar__track {
  flex: 1 1 auto;
  min-width: var(--space-32);
  height: var(--track-height);
  overflow: hidden;
  background: var(--track);
  border-radius: var(--radius-full);
}

.progress-bar__fill {
  display: block;
  height: 100%;
  background: var(--track-fill);
  border-radius: inherit;
  transition: width var(--duration-base) var(--ease-standard);
}

/* Phone widths (ticket 411): the large buttons can't share a row with Remove frame, Turn row direction and the track at
 * 360px in every language, so they take a second row, half the bar each. The bar is taller: --progress-height
 * (controls.css), which things above follow. */
@media (max-width: 30rem) {
  .progress-bar {
    flex-wrap: wrap;
    align-content: center;
    /* Remove frame, Edit Frame and Turn row direction share the first row with the counter and the track (ticket
     * 443): 4px between them keeps it one row at 320px, inside the 12px screen edge (ticket 450). */
    gap: var(--space-4);
    padding-inline: var(--space-4);
  }

  .progress-bar__track {
    min-width: var(--space-32);
  }

  .progress-bar__steps {
    flex: 1 1 100%;
    min-width: 0;
    gap: var(--space-4);
  }

  /* A button is wrapped (for its Tooltip) only while it has one, so a lone button is a flex item too. */
  .progress-bar__steps > .app-button,
  .progress-bar__steps :deep(.app-button-wrap) {
    flex: 1 1 0;
    min-width: 0;
  }

  .progress-bar__steps :deep(.app-button) {
    width: 100%;
    min-width: 0;
    padding-inline: var(--space-6);
    gap: var(--space-2);
    justify-content: center;
    font: var(--type-small);
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-bar__fill {
    transition: none;
  }
}
</style>
