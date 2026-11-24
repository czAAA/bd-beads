<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Project } from '../../domain/project'
import type { SeenWay } from '../../domain/rowProgress'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useI18n } from '../../i18n/useI18n'
import RowProgressControls from './RowProgressControls.vue'
import type { RowPress } from '../../composables/project/useRowOps'
import { frameOf, lastEditedFrameId } from '../../domain/layerRecord'
import { columnsAsSeen, rowProgressPosition } from '../../domain/rowProgress'
import { rowItemsWidth, useFittingForm } from '../../composables/canvas/useFittingForm'
import { useElementSize } from '../../composables/ui/useElementSize'

// Progress bar (CONTEXT.md; tickets 144, 411, 426, ProgressBar card): every Row progress control along the canvas box's
// bottom; with no Frame (ADR 0055) the footer isn't shown (CanvasPanel), with one its RowProgressControls (0657). The
// Homepage fills it with its sections through the slot, with no Project (0739); the editor with none leaves it empty (0748).
const props = withDefaults(defineProps<{
  /** The Project whose Row progress it shows; none where the slot fills the bar, or where the bar is empty. */
  project?: Project
  /** Whether the Canvas draws the Row progress look (ticket 474): pressed while it does. */
  rowHighlight?: boolean
  /** The last press of Row done or Row not done (ticket 0730): Row done flares the track's spark. */
  rowPress?: RowPress
}>(), { rowHighlight: true })

const emit = defineEmits<{
  'move-row': [delta: number]
  /** Reset progress, which asks first (ticket 455); it is only enabled once a row is done. */
  'reset-progress': []
  /** A way chosen from Turn row direction's list (ticket 0973). */
  'set-row-direction': [way: SeenWay]
  'toggle-row-highlight': []
}>()

const { locale } = useI18n()

// One Tab stop; ←/→ step along the bar's controls and stop at the ends (ADR 0075).
const rootEl = ref<HTMLElement>()
const roving = useRovingFocus(rootEl, { axis: () => 'horizontal', managesTabIndex: true })

/** Row progress works on the Frame's rows, so with no Frame the bar can only ask for one. */
const hasFrame = computed(() => props.project !== undefined && frameOf(props.project) !== undefined)
/** The Frame it is of (ticket 1222): the Last edited Frame, until the bar is retired for each Frame's own strip. */
const shown = computed(() => lastEditedFrameId(props.project))

/** The counter's words where the bar's row has room for them, else its short form, "5/30" (ticket 1183): a long
 * language's "Column done" leaves too little at a width the counter's words otherwise fit. */
const COUNT_FORMS = ['words', 'short'] as const
const { width: barRoom } = useElementSize(rootEl)
const countFit = useFittingForm({
  forms: () => (hasFrame.value ? COUNT_FORMS : []),
  room: () => barRoom.value,
  measure: () => {
    const row = rootEl.value?.querySelector<HTMLElement>(':scope > .row-progress')
    const items = [...(row?.children ?? [])].filter((item): item is HTMLElement => item instanceof HTMLElement && getComputedStyle(item).display !== 'none')
    return rootEl.value ? rowItemsWidth(items, Number.parseFloat(getComputedStyle(rootEl.value).columnGap) || 0) : 0
  },
  observed: () => [rootEl.value?.querySelector('.row-progress__count')],
  labels: () => (props.project ? JSON.stringify([locale.value, columnsAsSeen(props.project, shown.value), rowProgressPosition(props.project, shown.value)]) : locale.value),
})
</script>

<template>
  <div ref="rootEl" class="progress-bar no-page-pan" data-testid="progress-bar" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
    <slot>
    <RowProgressControls
      v-if="project && hasFrame"
      :project="project"
      :frame="shown"
      :row-highlight="rowHighlight"
      :row-press="rowPress"
      form="bar"
      :short-count="countFit === 'short'"
      testid="progress-bar"
      @move-row="emit('move-row', $event)"
      @reset-progress="emit('reset-progress')"
      @set-row-direction="emit('set-row-direction', $event)"
      @toggle-row-highlight="emit('toggle-row-highlight')"
    />
    </slot>
  </div>
</template>

<style scoped>
.progress-bar {
  container-type: inline-size;
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-12);
  box-sizing: border-box;
  /* As tall as its tallest item plus 1px above and below (ticket 544); --progress-height is the same rule for the
   * Homepage's empty footer. The bottom corners follow the canvas box's curve; 24 at both ends keeps what it holds off
   * the box's edge (ticket 0780). Where the app shell runs it to the screen's bottom edge over a safe-area inset (the
   * iPad's home indicator, ticket 0788), it grows by the inset and keeps what it holds above it. */
  min-height: calc(var(--progress-height) + var(--bar-bottom-inset, 0px));
  padding: var(--bar-pad) var(--space-24) calc(var(--bar-pad) + var(--bar-bottom-inset, 0px));
  border: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
  border-bottom: 0;
  border-radius: 0 0 var(--canvas-box-radius) var(--canvas-box-radius);
}

/* Phone widths (ticket 411): Back a row and Row done take a second row (RowProgressControls), so the bar wraps and is taller:
 * --progress-height (controls.css), which things above follow. */
@media (max-width: 30rem) {
  .progress-bar {
    flex-wrap: wrap;
    align-content: center;
    /* Remove frame, Edit Frame and Turn row direction share the first row with the counter and the track (ticket
     * 443): 4px between them keeps it one row at 320px, inside the 12px screen edge (ticket 450). */
    gap: var(--space-4);
    padding-inline: var(--space-4);
  }
}
</style>
