<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { frameRowOrder, passLine, rowProgressOf, rowProgressPosition, shownWay, type ShownWay } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { customPassWords, rowProgressCount } from '../../i18n/rowProgressWords'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { RowPress } from '../../composables/project/useRowOps'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import GoToRowPopover from './GoToRowPopover.vue'
import ProgressMoves from './ProgressMoves.vue'
import ProgressTrack from './ProgressTrack.vue'
import RowDirectionPopover from './RowDirectionPopover.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import IconButton from '../ui/IconButton.vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { frameOf } from '../../domain/layerRecord'
import { pieceFaceOf } from '../../domain/pieceFaces'

// Row progress's controls (ProgressBar and MarginSheet cards; tickets 144, 411, 0657, 0658): one component in the
// Progress bar and the margin sheet's top band, so a press in either moves the one pointer the Project carries. `bar`
// spells the row out; on the margin, `margin` is the full form, `compact` and `folded` its smaller ones.
const props = withDefaults(defineProps<{
  project: Project
  /** Whether the Canvas draws the Row progress look (ticket 474): the Switch is on while it does. */
  rowHighlight?: boolean
  form: 'bar' | 'margin' | 'compact' | 'folded'
  /** On the margin, what a row too narrow for the whole form gives up (ticket 0698): 1 the track, 2 the counter too, so
   * Row done and Row highlight go last. */
  drop?: 0 | 1 | 2
  /** The prefix of the controls' test ids, so the two places can be told apart. */
  testid: string
  /** The last press of Row done or Back a row, wherever it was made (ticket 0730): Row done flares the spark. */
  rowPress?: RowPress
  /** On the margin, no Back a row: the Homepage demo's band (ticket 0797, MarginSheet card), the Progress bar keeping
   * its own. */
  withoutNotDone?: boolean
}>(), { rowHighlight: true, drop: 0, withoutNotDone: false })

const emit = defineEmits<{
  'move-row': [delta: number]
  /** Reset progress, which asks first (ticket 455); it is only enabled once a row is done. */
  'reset-progress': []
  /** A way chosen from Turn row direction's list (ticket 0973, UX-060): its press only opens the list. */
  'set-row-direction': [way: ShownWay]
  'toggle-row-highlight': []
  /** Go to row, from the bar's counter (ticket 0849): the pass to point at, from 0. */
  'go-to-row': [pass: number]
  /** Go to row's Show row (ticket 0934): the current row brought back into view, the pointer where it is. */
  'show-row': []
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
  goToRow: controlAction('go-to-row'),
}
const deps = computed(() => controlDeps({ activeProject: () => props.project }))

const position = computed(() => rowProgressPosition(props.project))

/** Rows before the current one are finished. */
const finishedShare = computed(() => (position.value.total > 0 ? position.value.current / position.value.total : 0))

/** Each Row done flares the track's spark (ticket 0730), wherever it was pressed; Back a row moves it with none. */
const flares = ref(0)
watch(
  () => props.rowPress,
  (press) => {
    if (press?.done) flares.value += 1
  },
)

const columnWise = computed(() => rowProgressOf(props.project).direction === 'columns')

/** Row done and Back a row name what is woven in the direction the rows run: a row, or a column (ticket 411). */
const doneLabel = computed(() => (columnWise.value ? t.value.rowProgress.columnNextButton : t.value.rowProgress.nextButton))
const notDoneLabel = computed(() => (columnWise.value ? t.value.rowProgress.columnPreviousButton : t.value.rowProgress.previousButton))

/** The row shown as current: the last one once every pass is done. */
const shownRow = computed(() => Math.min(position.value.current + 1, position.value.total))

/** Every pass is done (ticket 0849, F-04-09): the bar says Pattern done, so it can't be read as the last row or as
 * never started. */
const allDone = computed(() => position.value.total > 0 && position.value.current >= position.value.total)
const allDoneBody = computed(() => (columnWise.value ? t.value.rowProgress.everyColumnDone : t.value.rowProgress.everyRowDone))

/** The counter names its step, "Row 7 of 10", and on peyote, where a line takes two passes, "Pass 3 of 27 · row 2"
 * with the rulers' row (tickets 0849 F-04-03, 0972): the announcer's own words. A narrow bar shows "7/10". */
const count = computed(() => rowProgressCount(t.value.rowProgress, props.project))
const line = computed(() => passLine(props.project))
/** On peyote Go to row holds the sentence that says what a pass is behind an Info button (ticket 0972, UX-062). */
const passesInfo = computed(() => {
  const words = t.value.rowProgress
  if (!line.value) return undefined
  const body = fillBlanks(columnWise.value ? words.columnPassesBody : words.passesBody, { passes: position.value.total, lines: line.value.lines })
  return { label: words.passesInfoName, body }
})
/** On a Kaleidocycle it first says the triangles here are this face's, of the piece's 24 (ticket 0876). */
const counterBody = computed(() => {
  const words = t.value.rowProgress
  if (allDone.value) return allDoneBody.value
  if (passesInfo.value) return passesInfo.value.body
  const body = columnWise.value ? words.goToColumnBody : words.goToRowBody
  const face = pieceFaceOf(frameOf(props.project)?.shape)
  return face ? fillBlanks(words.faceBody, { parts: face.parts, total: face.total, then: body }) : body
})

/** Go to row, opened by the bar's counter (ticket 0849, F-04-14): its number counts what the counter does, passes
 * where a line takes two or the Frame is a Custom frame. */
const goToOpen = ref(false)
/** The counter's button, which Go to row hangs from: taken from its press, as a ref inside the items' loop is a list. */
const counterButton = ref<HTMLElement>()
function toggleGoTo(event: MouseEvent) {
  counterButton.value = event.currentTarget as HTMLElement
  goToOpen.value = !goToOpen.value
}
/** Where the number counts passes, Go to row is Go to pass, one noun with its field (ticket 0972, UX-062). */
const countsPasses = computed(() => line.value !== undefined || frameRowOrder(props.project).stepOf !== undefined)
const goToTitle = computed(() => {
  const words = t.value.rowProgress
  if (countsPasses.value) return words.goToPass
  return columnWise.value ? words.goToColumn : words.goToRow
})
const goToUnit = computed(() => {
  const words = t.value.rowProgress
  if (countsPasses.value) return words.passLabel
  return columnWise.value ? words.columnLabel : words.positionLabel
})

/** A Custom frame's pass in words in place of "Row 3 of 20 · Top to bottom" (ticket 0594): none for a Frame without a
 * Frame shape. */
const customPosition = computed(() => customPassWords(t.value.rowProgress, props.project, shownRow.value))

/** The turn that points the down arrow along the rows: the arrows are drawn for top to bottom (ticket 0589). A turned
 * Frame's rows run turned with it (ticket 0667). */
const arrowTurn = computed(() => shownWay(rowProgressOf(props.project), frameOf(props.project)?.quarterTurns))

const directionLabel = computed(() => {
  const words = t.value.rowProgress
  const labels = { down: words.topToBottom, up: words.bottomToTop, right: words.leftToRight, left: words.rightToLeft }
  return labels[arrowTurn.value]
})

/** Turn row direction's list (ticket 0973, UX-060): its press opens it and turns nothing; Row highlight is in it too. */
const directionOpen = ref(false)
const directionButton = ref<HTMLElement>()
function toggleDirection(event: MouseEvent) {
  directionButton.value = event.currentTarget as HTMLElement
  directionOpen.value = !directionOpen.value
}
const turns = computed(() => frameRowOrder(props.project).turns)
/** In the bar Row highlight is Show row marks in that list, so it stands alone only where the rows run one way (a
 * Custom frame). */
const highlightShown = computed(() => props.form !== 'bar' || !turns.value)

type Item = 'direction' | 'highlight' | 'reset' | 'position' | 'counter' | 'track' | 'divider' | 'steps'
/** The bar's order (ProgressBar card), and the margin's, which puts Reset beside Turn row direction and sets the
 * counter off with dividers, then its smaller forms, which keep Row highlight beside Row done (MarginSheet card, Zoom
 * forms; ticket 0698). */
const ITEMS: Record<typeof props.form, readonly Item[]> = {
  bar: ['direction', 'highlight', 'reset', 'position', 'counter', 'track', 'steps'],
  margin: ['direction', 'reset', 'highlight', 'divider', 'counter', 'track', 'divider', 'steps'],
  compact: ['highlight', 'counter', 'track', 'steps'],
  folded: ['highlight', 'counter', 'steps'],
}
/** What each drop leaves out: the track, then the counter with the divider that set it off. */
const DROPPED: Record<0 | 1 | 2, readonly Item[]> = { 0: [], 1: ['track'], 2: ['track', 'counter'] }
const items = computed(() => {
  const left = ITEMS[props.form].filter((item) => !DROPPED[props.drop].includes(item))
  return left.filter((item, index) => item !== 'divider' || left[index + 1] !== 'divider')
})
const margin = computed(() => props.form !== 'bar')
/** The smaller forms keep Row done alone: Back a row is the Progress bar's there. */
const small = computed(() => props.form === 'compact' || props.form === 'folded')
</script>

<template>
  <div class="row-progress" :class="[`row-progress--${form}`, { 'row-progress--margin': margin, 'row-progress--small': small }]" :data-testid="margin ? testid : undefined">
  <template v-for="(item, index) in items" :key="`${item}-${index}`">
    <!-- Turn row direction and Reset progress sit away from the do/undo pair, so they can't be hit while doing rows (tickets 411, 455). -->
    <!-- Its press opens the list of the four ways and turns nothing (ticket 0973). -->
    <IconButton
      v-if="item === 'direction' && turns"
      :variant="margin ? 'plain' : 'box'"
      :action="actions.direction"
      aria-haspopup="dialog"
      :aria-expanded="directionOpen"
      :data-testid="`${testid}-direction`"
      @click="toggleDirection"
    />
    <!-- Row highlight is a view switch, not an action on the Project: an on/off Switch (ticket 474); the parent owns the value and flips it. -->
    <AppSwitch
      v-else-if="item === 'highlight' && highlightShown"
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
    <!-- In the bar the counter is Go to row's button (ticket 0849), and once every pass is done it reads Pattern done. -->
    <AppButton
      v-else-if="item === 'counter' && !margin"
      class="row-progress__counter-button"
      variant="text"
      size="sm"
      :icon="allDone ? 'check' : undefined"
      :action="actions.goToRow"
      :label="goToTitle"
      :tooltip="{ body: counterBody }"
      aria-haspopup="dialog"
      :aria-expanded="goToOpen"
      :data-testid="`${testid}-compact-position`"
      @click="toggleGoTo"
    >
      <template v-if="allDone">{{ t.rowProgress.patternDone }}</template>
      <template v-else>
        <span class="row-progress__count-step">{{ count.step }}</span><span class="row-progress__count-short">{{ count.short }}</span><span
          v-if="count.line"
          class="row-progress__line"
        >&nbsp;{{ count.line }}</span>
      </template>
    </AppButton>
    <!-- The compact counter (ticket 188): "1/222" in place of the spelled-out row count; the buttons keep their text (ticket 411). -->
    <p v-else-if="item === 'counter'" class="row-progress__counter" :data-testid="`${testid}-compact-position`">
      {{ shownRow }}/{{ position.total }}
    </p>
    <ProgressTrack
      v-else-if="item === 'track'"
      class="row-progress__track"
      :class="{ 'row-progress__track--margin': margin }"
      :share="finishedShare"
      :flares="flares"
      :compact="margin"
      glints
      :label="columnWise ? t.rowProgress.columnFinishedLabel : t.rowProgress.finishedLabel"
      :min="0"
      :max="position.total"
      :now="position.current"
      :testid="testid"
    />
    <span v-else-if="item === 'divider'" class="row-progress__divider" aria-hidden="true" />
    <!-- Back a row and Row done follow Row direction with their label and arrow (ticket 411). In the bar they are the
      Progress bar's one pair, the same as Back and Next on a bar of steps (ticket 0788); on the margin Back a row is
      its arrow alone, named by the label, and the smaller forms leave it to the Progress bar. -->
    <ProgressMoves
      v-else-if="item === 'steps' && !margin"
      :class="`row-progress__steps--${arrowTurn}`"
      :back="{ action: actions.notDone, label: notDoneLabel, icon: 'arrow-up', disabled: position.current === 0, testid: `${testid}-previous` }"
      :forward="{ action: actions.done, label: doneLabel, trailingIcon: 'arrow-down', disabled: position.current >= position.total, disabledBody: allDoneBody, testid: `${testid}-next` }"
      @back="emit('move-row', -1)"
      @forward="emit('move-row', 1)"
    />
    <div v-else-if="item === 'steps'" class="row-progress__steps" :class="`row-progress__steps--${arrowTurn}`">
      <IconButton
        v-if="!small && !withoutNotDone"
        variant="plain"
        :action="actions.notDone"
        :label="notDoneLabel"
        icon="arrow-up"
        :disabled="position.current === 0"
        :data-testid="`${testid}-previous`"
        @click="emit('move-row', -1)"
      />
      <AppButton
        variant="primary"
        size="sm"
        :action="actions.done"
        :label="doneLabel"
        trailing-icon="arrow-down"
        :disabled="position.current >= position.total"
        :disabled-body="allDoneBody"
        :data-testid="`${testid}-next`"
        @click="emit('move-row', 1)"
      />
    </div>
  </template>
  <RowDirectionPopover
    v-if="directionOpen && directionButton"
    :anchor="directionButton"
    :current="arrowTurn"
    :row-highlight="rowHighlight"
    :side="margin ? 'below' : 'above'"
    :testid="testid"
    @close="directionOpen = false"
    @choose="emit('set-row-direction', $event)"
    @toggle-row-highlight="emit('toggle-row-highlight')"
  />
  <GoToRowPopover
    v-if="goToOpen && counterButton"
    :anchor="counterButton"
    :title="goToTitle"
    :unit="goToUnit"
    :current="shownRow"
    :total="position.total"
    :show-label="columnWise ? t.rowProgress.showColumn : t.rowProgress.showRow"
    :info="passesInfo"
    @close="goToOpen = false"
    @go="emit('go-to-row', $event)"
    @show="emit('show-row')"
  />
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

/* The bar's counter is Go to row's quiet button (ticket 0849), in the title role so it reads at arm's length (ticket
 * 0972, UX-063), with 6px either side. */
.row-progress--bar :deep(.row-progress__counter-button) {
  flex: none;
  padding-inline: var(--space-6);
  gap: var(--space-4);
  font: var(--type-title);
}

/* From 40rem up it names its step, "Row 7 of 10"; a narrower bar keeps the short "7/10" (ticket 0972). */
.row-progress__count-short {
  display: none;
}

@container (width < 40rem) {
  .row-progress__count-step {
    display: none;
  }

  .row-progress__count-short {
    display: inline;
  }
}

/* A bar too narrow for it on one row (the Homepage demo's on a tablet) leaves the rulers' row to the Tooltip; on a phone
 * the bar wraps, so it has the room. */
@media (min-width: 30.01rem) {
  @container (max-width: 40rem) {
    .row-progress__line {
      display: none;
    }
  }
}

/* The wide row count stays out of the bar: the short counter stands in for it at every width (ticket 188, 295; ADR
 * 0046). */
.row-progress__phone-hide {
  display: none;
}

/* On the margin, Back a row's arrow and Row done sit 4px apart; in the bar they are ProgressMoves. */
.row-progress__steps {
  display: flex;
  flex: none;
  align-items: center;
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

/* On the margin the track is 64px (MarginSheet card). */
.row-progress__track--margin {
  flex: none;
  width: var(--margin-track);
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

/* Phone widths (ticket 411): Back a row and Row done take a second row (ProgressMoves), so the bar wraps. */
@media (max-width: 30rem) {
  .row-progress--bar .row-progress__track {
    min-width: var(--space-32);
  }
}
</style>
