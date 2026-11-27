<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useFittingForm } from '../../composables/canvas/useFittingForm'
import { useTitleBlockFold } from '../../composables/canvas/useTitleBlockFold'
import type { RowPress } from '../../composables/project/useRowOps'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import type { FrameId } from '../../domain/grid'
import { frameById } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { columnsAsSeen, rowProgressPosition, type SeenWay } from '../../domain/rowProgress'
import { useI18n } from '../../i18n/useI18n'
import type { MarginForm } from '../../rendering/marginForm'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import MarginFrameFacts from './MarginFrameFacts.vue'
import type { FactsForm } from './marginForms'
import RowProgressControls from './RowProgressControls.vue'
import { STRIP_FITS, STRIP_FIT_PROPS, stripWidth, type StripFit } from './rowProgressFit'

// The margin sheet's foot (MarginSheet card, Calmer sheet; tickets 1176, 1258): what weaving reads, then Row progress,
// on one line; where the sheet is too narrow, the facts over the strip while the band holds two rows. The strip gives up
// its parts before the facts leave, and Row done stays to the last.
const props = defineProps<{
  project: Project
  frame: FrameId
  rowHighlight?: boolean
  rowPress?: RowPress
  /** The foot's room, the sheet's width inside its inset, in the sheet's drafting px, and what it is drawn at. */
  room: number
  scale: number
  /** The sheet's form; the expanded sheet's is `full`. */
  sheetForm: MarginForm
  expanded?: boolean
  /** Whether the band holds two rows. */
  stacks: boolean
}>()

const emit = defineEmits<{
  'move-row': [delta: number]
  'reset-progress': []
  'set-row-direction': [way: SeenWay]
  'toggle-row-highlight': []
  'replace-bead': [beadId: string]
  'set-letters': [on: boolean]
  /** The strip's least width as laid out, in drafting px (0 until it has shown), for the expanded sheet. */
  'least-strip': [width: number]
}>()

const { t, locale } = useI18n()
const canvas = useCanvasBackground(() => props.project)
const fold = useTitleBlockFold()
const touch = useMediaQuery('(pointer: coarse)')
const frameLayer = computed(() => frameById(props.project, props.frame))

const ALL_FACTS: readonly FactsForm[] = ['all', 'noEstimate', 'noSize', 'noBead', 'legend']
/** The facts the foot may hold: none folded (by hand or by the zoom) or with Name and size on the margin off; compact,
 * the legend alone. */
const factForms = computed<readonly FactsForm[]>(() => {
  if (!canvas.margin.titleBlock.value || fold.folded.value) return []
  if (props.sheetForm === 'full') return ALL_FACTS
  return props.sheetForm === 'compact' ? ['legend'] : []
})

/** `line`: the facts then Row progress; `stacked`: the facts over it; `alone`: Row progress without them. */
type Layout = 'line' | 'stacked' | 'alone'
type FootForm = `${Layout}:${StripFit}`
const strips = (layout: Layout) => STRIP_FITS.map((fit): FootForm => `${layout}:${fit}`)
const footForms = computed<readonly FootForm[]>(() => {
  if (!frameLayer.value || props.sheetForm === 'bare') return []
  if (!factForms.value.length) return strips('alone')
  // Two rows: one line only while the strip keeps its track on it.
  if (props.stacks) return ['line:whole', 'line:short', ...strips('stacked')]
  return [...strips('line'), ...strips('alone')]
})

const rootEl = ref<HTMLElement>()
const progressEl = ref<HTMLElement>()
const facts = ref<InstanceType<typeof MarginFrameFacts>>()
/** The compact and folded sheets' strip has round buttons (ticket 1256), by pointer. */
const compactStrip = computed(() => (props.sheetForm === 'full' ? undefined : touch.value ? 'touch' : 'mouse'))
/** What the strip reads: Row done or Column done, the counter, the language (ticket 0851). */
const stripLabels = computed(() => {
  const { current, total } = rowProgressPosition(props.project, props.frame)
  // Its words, not the language alone: a language's words arrive after it is chosen.
  return JSON.stringify([locale.value, t.value.rowProgress, columnsAsSeen(props.project, props.frame), current, total, touch.value, !!props.expanded, compactStrip.value])
})

/** The least form's width as last laid out. */
const leastStripWidth = ref(0)
// A width learnt for other words is forgotten, as the fitting's are.
watch(stripLabels, () => (leastStripWidth.value = 0))
watch(leastStripWidth, (width) => emit('least-strip', width), { immediate: true })

const fitting = useFittingForm<FootForm>({
  forms: () => footForms.value,
  room: () => props.room,
  measure: () => {
    const strip = stripWidth(progressEl.value?.firstElementChild as HTMLElement | null | undefined, props.scale)
    if (!strip) return 0
    if (shown.value?.fit === STRIP_FITS.at(-1)) leastStripWidth.value = strip
    const beside = shown.value?.layout === 'line' ? rootEl.value?.querySelector<HTMLElement>('.margin-facts')?.offsetWidth : 0
    if (!beside) return strip
    return strip + beside + (Number.parseFloat(getComputedStyle(rootEl.value!).columnGap) || 0)
  },
  observed: () => [progressEl.value?.firstElementChild, rootEl.value?.querySelector('.margin-facts')],
  labels: () => JSON.stringify([stripLabels.value, facts.value?.words]),
})
/** The layout and the strip's form shown. Where none fits, and bare, the strip is not drawn, so Row done never stands
 * outside the margin (ticket 1245); expanded it stays at its least, and the sheet widens to it. */
const shown = computed<{ layout: Layout; fit: StripFit } | undefined>(() => {
  const form = fitting.value ?? (props.expanded ? footForms.value.at(-1) : undefined)
  if (!form) return undefined
  const [layout, fit] = form.split(':') as [Layout, StripFit]
  return { layout, fit }
})

const factsShown = computed<{ forms: readonly FactsForm[]; room: number }>(() => {
  const layout = shown.value?.layout
  if (layout === 'alone') return { forms: [], room: props.room }
  if (layout === 'line') return { forms: factForms.value.slice(0, 1), room: Number.POSITIVE_INFINITY }
  return { forms: factForms.value, room: props.room }
})

/** Row progress is one Tab stop, ←/→ along its controls, as in the Progress bar (ADR 0075). */
const roving = useRovingFocus(progressEl, { axis: () => 'horizontal', managesTabIndex: true })
</script>

<template>
  <div
    ref="rootEl"
    class="margin-sheet__foot"
    :class="[shown?.layout === 'stacked' ? 'margin-sheet__foot--stacked' : 'margin-sheet__foot--line', `margin-sheet__foot--${sheetForm}`, { 'margin-sheet__foot--touch': touch }]"
  >
    <MarginFrameFacts
      ref="facts"
      :project="project"
      :frame="frame"
      :forms="factsShown.forms"
      :room="factsShown.room"
      @replace-bead="emit('replace-bead', $event)"
      @set-letters="emit('set-letters', $event)"
    />
    <div v-if="shown" ref="progressEl" class="margin-sheet__progress" :data-form="shown.fit" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
      <RowProgressControls
        :project="project"
        :frame="frame"
        :row-highlight="rowHighlight"
        :row-press="rowPress"
        v-bind="STRIP_FIT_PROPS[shown.fit]"
        :compact="compactStrip"
        testid="margin-progress"
        @move-row="emit('move-row', $event)"
        @reset-progress="emit('reset-progress')"
        @set-row-direction="emit('set-row-direction', $event)"
        @toggle-row-highlight="emit('toggle-row-highlight')"
      />
    </div>
  </div>
</template>

<style scoped>
.margin-sheet__foot {
  display: flex;
  box-sizing: border-box;
}

.margin-sheet__foot--line {
  align-items: center;
  gap: var(--space-12);
}

.margin-sheet__foot--stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
}

.margin-sheet__foot--line.margin-sheet__foot--compact {
  gap: var(--space-8);
}

/* Beside Row progress the facts keep their whole width, which the foot was fitted to. */
.margin-sheet__foot--line :deep(.margin-facts) {
  flex: none;
}

.margin-sheet__progress {
  display: flex;
  flex: 1 0 auto;
  min-width: 0;
}

.margin-sheet__foot--stacked .margin-sheet__progress {
  flex: none;
  align-self: stretch;
}

/* On a coarse pointer the two rows stand further apart, so their 44px hit areas meet less. */
@media (pointer: coarse) {
  .margin-sheet__foot--stacked {
    gap: var(--space-8);
  }
}

/* So do the full strip's buttons: 44px hit areas that never overlap, two icons side by side standing twice as far apart.
 * The compact strip's areas are as wide as drawn (ticket 1256). */
.margin-sheet__foot--touch :deep(.row-progress:not(.row-progress--compact) > :is(.app-button-wrap, .icon-btn-wrap) + *),
.margin-sheet__foot--touch :deep(.row-progress:not(.row-progress--compact) > * + :is(.app-button-wrap, .icon-btn-wrap)) {
  margin-inline-start: calc((var(--touch-target) - var(--margin-done-compact)) / 2 - var(--space-8));
}

.margin-sheet__foot--touch :deep(.row-progress:not(.row-progress--compact) > .icon-btn-wrap + .icon-btn-wrap) {
  margin-inline-start: calc(var(--touch-target) - var(--margin-tool-compact) - var(--space-8));
}
</style>
