<script setup lang="ts">
import type { FrameId } from '../../domain/grid'
import { computed, ref, watch } from 'vue'
import { columnsAsSeen, frameRowOrder, rowProgressPosition, rowProgressStarted, seenWayOf, type SeenWay } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { rowProgressCount } from '../../i18n/rowProgressWords'
import { controlAction } from '../../composables/shell/controlRegistry'
import type { RowPress } from '../../composables/project/useRowOps'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'
import ProgressTrack from './ProgressTrack.vue'
import RowDirectionPopover from './RowDirectionPopover.vue'

// Row progress's strip (MarginSheet card, "Several Frames"; tickets 1176, 1223): the one Row progress, on each Frame's
// margin sheet and, as `woven`, under the Homepage cuff, which has nothing to turn or reset. Back a row, the counter as a
// button with its list (the four ways, Show row marks, Reset progress), the track and Row done.
const props = withDefaults(defineProps<{
  project: Project
  /** The Frame whose Row progress this is: its own pointer, counter and direction. */
  frame: FrameId
  /** Whether the Canvas draws the Row progress look (ticket 474): the Switch is on while it does. */
  rowHighlight?: boolean
  /** `woven` is the Homepage cuff's (ticket 1157): the counter is text, nothing to press, and the keys stay the page's. */
  form?: 'strip' | 'woven'
  /** What a strip too narrow for the whole of it gives up: 1 the track, 2 Back a row's words too, 3 Row done's. */
  drop?: 0 | 1 | 2 | 3
  /** The prefix of the controls' test ids, so the places can be told apart. */
  testid: string
  /** The last press of Row done or Back a row, wherever it was made (ticket 0730): Row done flares the spark. */
  rowPress?: RowPress
  /** The counter's short "5/30" in place of "Row 5 of 30" (ticket 1176): the first it gives up. */
  shortCount?: boolean
}>(), { rowHighlight: true, form: 'strip', drop: 0, shortCount: false })

const emit = defineEmits<{
  'move-row': [delta: number]
  /** Reset progress, which asks first (ticket 455); it is only enabled once a row is done. */
  'reset-progress': []
  /** A way chosen from the counter's list (ticket 0973). */
  'set-row-direction': [way: SeenWay]
  'toggle-row-highlight': []
}>()

const { t } = useI18n()

/** Every control here is a registry action: its name, Tooltip, key chip and disabled reason come from there (ADR
 * 0035). */
const actions = {
  notDone: keyedHere(controlAction('row-not-done')),
  done: keyedHere(controlAction('row-done')),
}

/** On the Homepage's cuff Enter and Shift+Enter stay the page's (ticket 1157), so its moves show no key. */
function keyedHere<Action extends { chords: readonly unknown[] }>(action: Action): Action {
  return props.form === 'woven' ? { ...action, chords: [] } : action
}

const position = computed(() => rowProgressPosition(props.project, props.frame))

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

const columnWise = computed(() => columnsAsSeen(props.project, props.frame))

/** Row done and Back a row name what is woven in the direction the rows run: a row, or a column (ticket 411). */
const doneLabel = computed(() => (columnWise.value ? t.value.rowProgress.columnNextButton : t.value.rowProgress.nextButton))
const notDoneLabel = computed(() => (columnWise.value ? t.value.rowProgress.columnPreviousButton : t.value.rowProgress.previousButton))

/** Every pass is done (ticket 0849, F-04-09): the counter says Pattern done, so it can't be read as the last row or as
 * never started. */
const allDone = computed(() => position.value.total > 0 && position.value.current >= position.value.total)
const allDoneBody = computed(() => (columnWise.value ? t.value.rowProgress.everyColumnDone : t.value.rowProgress.everyRowDone))

/** The counter names its step, "Row 7 of 10", and on peyote, where a line takes two passes, "Pass 3 of 27 · row 2"
 * with the rulers' row (tickets 0849 F-04-03, 0972); a Custom frame's "Round 3 of 9". A narrow strip shows "7/10". */
const count = computed(() => rowProgressCount(t.value.rowProgress, props.project, props.frame))

/** The way the arrows point: drawn for top to bottom (ticket 0589), turned to the way the rows run as seen, which Row
 * progress keeps (spec 1182). */
const arrowTurn = computed(() => seenWayOf(props.project, props.frame))
/** A Custom frame's rows run one way only: its list holds no directions. */
const turns = computed(() => frameRowOrder(props.project, props.frame).turns)
const canReset = computed(() => rowProgressStarted(props.project, props.frame))

/** The counter's list (ticket 0973, 1223): its press opens it and turns nothing. */
const listOpen = ref(false)
const counterEl = ref<HTMLElement>()
function toggleList(event: MouseEvent) {
  counterEl.value = event.currentTarget as HTMLElement
  listOpen.value = !listOpen.value
}

type Item = 'back' | 'counter' | 'track' | 'divider' | 'done'
const ITEMS: readonly Item[] = ['back', 'divider', 'counter', 'track', 'divider', 'done']
/** What each drop leaves out: the track, with the divider that set it off. */
const items = computed(() => {
  const left = ITEMS.filter((item) => !(item === 'track' && props.drop >= 1))
  return left.filter((item, index) => item !== 'divider' || left[index + 1] !== 'divider')
})
const woven = computed(() => props.form === 'woven')
</script>

<template>
  <div class="row-progress" :class="[`row-progress--${form}`, { 'row-progress--short': shortCount }]" :data-testid="`${testid}-strip`">
  <template v-for="(item, index) in items" :key="`${item}-${index}`">
    <!-- Back a row stays to the last: its words go before it does, leaving its arrow. -->
    <IconButton
      v-if="item === 'back' && drop >= 2"
      variant="plain"
      :action="actions.notDone"
      :label="notDoneLabel"
      icon="arrow-up"
      class="row-progress__back"
      :class="`row-progress__arrow--${arrowTurn}`"
      :disabled="position.current === 0"
      :data-testid="`${testid}-previous`"
      @click="emit('move-row', -1)"
    />
    <AppButton
      v-else-if="item === 'back'"
      variant="text"
      size="sm"
      class="row-progress__back"
      :class="`row-progress__arrow--${arrowTurn}`"
      :action="actions.notDone"
      :label="notDoneLabel"
      icon="arrow-up"
      :disabled="position.current === 0"
      :data-testid="`${testid}-previous`"
      @click="emit('move-row', -1)"
    >
      {{ notDoneLabel }}
    </AppButton>
    <!-- The counter is the strip's one settings button (1221 option 4B): its list holds the ways, Show row marks and
      Reset progress; once every pass is done it reads Pattern done. -->
    <component
      :is="woven ? 'p' : AppButton"
      v-else-if="item === 'counter'"
      class="row-progress__count"
      v-bind="woven ? {} : { variant: 'text', size: 'sm', trailingIcon: 'chevron-down', expanded: listOpen, 'aria-haspopup': 'dialog' }"
      :aria-label="allDone && shortCount ? t.rowProgress.patternDone : undefined"
      :data-testid="`${testid}-compact-position`"
      @click="woven ? undefined : toggleList($event)"
    >
      <AppIcon v-if="allDone" name="check" />
      <span v-if="allDone" class="row-progress__done-words">{{ t.rowProgress.patternDone }}</span>
      <template v-else>
        <span class="row-progress__count-step">{{ count.step }}</span><span class="row-progress__count-short">{{ count.short }}</span><span
          v-if="count.line"
          class="row-progress__line"
        >&nbsp;{{ count.line }}</span>
      </template>
    </component>
    <ProgressTrack
      v-else-if="item === 'track'"
      class="row-progress__track row-progress__track--margin row-progress__track--strip"
      :share="finishedShare"
      :flares="flares"
      compact
      glints
      :label="columnWise ? t.rowProgress.columnFinishedLabel : t.rowProgress.finishedLabel"
      :min="0"
      :max="position.total"
      :now="position.current"
      :testid="testid"
    />
    <span v-else-if="item === 'divider'" class="row-progress__divider" aria-hidden="true" />
    <!-- Row done is the one filled button on the strip now that the Progress bar is gone (1221 option 4B). -->
    <AppButton
      v-else-if="item === 'done'"
      variant="primary"
      size="sm"
      class="row-progress__done"
      :class="[`row-progress__arrow--${arrowTurn}`, { 'row-progress__done--icon': drop >= 3 }]"
      :action="actions.done"
      :label="doneLabel"
      trailing-icon="arrow-down"
      :disabled="position.current >= position.total"
      :disabled-body="allDoneBody"
      :aria-label="drop >= 3 ? doneLabel : undefined"
      :data-testid="`${testid}-next`"
      @click="emit('move-row', 1)"
    >
      <span class="row-progress__words">{{ doneLabel }}</span>
    </AppButton>
  </template>
  <RowDirectionPopover
    v-if="listOpen && counterEl"
    :anchor="counterEl"
    :current="arrowTurn"
    :turns="turns"
    :row-highlight="rowHighlight"
    :can-reset="canReset"
    :testid="testid"
    @close="listOpen = false"
    @choose="emit('set-row-direction', $event)"
    @toggle-row-highlight="emit('toggle-row-highlight')"
    @reset="emit('reset-progress')"
  />
  </div>
</template>

<style scoped>
/* The strip (MarginSheet card): one band of the title block's paper, 1px `margin-line` rules, its controls 4px apart. */
.row-progress {
  display: flex;
  flex: 1;
  align-items: center;
  box-sizing: border-box;
  gap: var(--space-4);
  min-width: 0;
  height: var(--margin-strip);
  padding-inline: var(--space-2);
  background: var(--margin-title);
  border: 1px solid var(--margin-line);
  border-radius: var(--radius-sm);
}

/* The counter: the control type, a chevron after it, `hover-fill` on hover; on the cuff it is text. */
.row-progress__count {
  flex: none;
  margin: 0;
  padding-inline: var(--space-4);
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
}

p.row-progress__count {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  height: var(--margin-done-compact);
}

.row-progress__count-short {
  display: none;
}

/* Short of room, Pattern done is its check alone, the button keeping its name. */
.row-progress--short .row-progress__done-words,
.row-progress--short .row-progress__count-step,
.row-progress--short .row-progress__line {
  display: none;
}

.row-progress--short .row-progress__count-short {
  display: inline;
}

/* Back a row and Row done keep to the strip's ends; the track fills what is left, never under 64 (ticket 1176). */
.row-progress__back,
.row-progress__done {
  flex: none;
}

.row-progress__track--margin {
  flex: none;
  width: var(--margin-track);
}

.row-progress__track--strip {
  flex: 1 0 var(--margin-track);
  width: auto;
  margin-inline: var(--space-4);
}

/* The arrows point along the rows: drawn for top to bottom, the arrows turn to point right, up or left. */
/* Row done's arrow alone, where even its words have no room. */
.row-progress__done--icon {
  padding-inline: var(--space-6);
}

.row-progress__done--icon .row-progress__words {
  display: none;
}

.row-progress__arrow--right :deep(svg) {
  transform: rotate(-90deg);
}

.row-progress__arrow--up :deep(svg) {
  transform: rotate(180deg);
}

.row-progress__arrow--left :deep(svg) {
  transform: rotate(90deg);
}

/* A 1px rule between Back a row, the counter and the track (MarginSheet card). */
.row-progress__divider {
  flex: none;
  width: 1px;
  height: var(--space-16);
  margin: 0 var(--space-2);
  background: var(--margin-line);
}

.row-progress :deep(.icon-btn) {
  width: var(--margin-tool-compact);
  height: var(--margin-tool-compact);
  border-radius: var(--margin-border-radius);
}

.row-progress :deep(.icon-btn:hover) {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}

/* Squarish, as the title block over it, not the pill a button is elsewhere (ticket 1245). */
.row-progress :deep(.app-button) {
  height: var(--margin-done-compact);
  border-radius: var(--margin-border-radius);
}

/* The counter and Back a row are quiet buttons: hover-fill, and the control type rather than the button's. */
.row-progress :deep(.app-button--text) {
  font: var(--type-control);
}
</style>
