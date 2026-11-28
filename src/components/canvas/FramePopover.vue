<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import BeadQuantities from '../palette/BeadQuantities.vue'
import PanelSection from '../shell/PanelSection.vue'
import AppButton from '../ui/AppButton.vue'
import FramePopoverBead from './FramePopoverBead.vue'
import FramePopoverNames from './FramePopoverNames.vue'
import FramePopoverProgress from './FramePopoverProgress.vue'
import FrameSizeSection from './FrameSizeSection.vue'
import { frameEstimate, frameSizeWords } from './frameEstimate'
import type { FrameToolItem } from './framePopoverTools'
import { controlDeps } from '../../composables/shell/controlRegistry'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import type { FrameEdge } from '../../domain/frame'
import { seenSize } from '../../domain/frameOrientation'
import { settingValuesOf, type FrameSettings } from '../../domain/frameShape'
import type { FrameId } from '../../domain/grid'
import { frameById, framesOf, soloFrame } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { SeenWay } from '../../domain/rowProgress'
import type { Technique } from '../../domain/weave'
import type { RowPress } from '../../composables/project/useRowOps'
import { frameLabel } from '../../i18n/frameLabel'
import { plural } from '../../i18n/plural'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'

// The Frame settings popover (MarginSheet card, Several Frames and Calmer sheet; tickets 1222, 1257): the head, the
// band's tools as tiles, then Names, Bead and Technique, Size, Row progress and Beads needed folded. Every tile and
// field is a second trigger of an existing action, with its name, check, confirmation and reason for being off.
const props = defineProps<{
  project: Project
  /** The Frame whose popover it is. */
  frame: FrameId
  items: readonly FrameToolItem[]
  deps: ReturnType<typeof controlDeps>
  rowHighlight?: boolean
  rowPress?: RowPress
}>()
const emit = defineEmits<{
  /** A tile was pressed: the host closes or holds the popover, then runs it. */
  tool: [item: FrameToolItem]
  rename: [name: string]
  'save-maker-name': [name: string]
  'set-technique': [technique: Technique]
  'set-setting': [id: string, value: number]
  'replace-bead': [beadId: string]
  'move-row': [delta: number]
  'set-row-direction': [way: SeenWay]
  'toggle-row-highlight': []
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  'set-settings': [change: FrameSettings]
  'reset-progress': []
  /** The popover is gone: held steppers settle into their one Undo step (ticket 0640). */
  settle: []
}>()

const { t, locale } = useI18n()
const held = computed(() => frameById(props.project, props.frame))
const name = computed(() => (held.value ? frameLabel(t.value, held.value, framesOf(props.project).findIndex((each) => each.id === props.frame)) : ''))
/** Its Technique and size in the head: "Peyote · 11 × 100", a Custom frame's "Kite · 9 rows". */
const meta = computed(() => {
  const frame = held.value
  if (!frame) return ''
  const first = settingValuesOf(frame)[0]
  if (first && frame.shape) return `${t.value.frame.shapes[frame.shape]} · ${plural(locale.value, first.value, t.value.frame.sizeSettings[first.name].summary)}`
  const { columns, rows } = seenSize(frame)
  return `${techniqueName(t.value, frame.technique)} · ${columns} × ${rows}`
})
const beadsProject = computed(() => soloFrame(props.project, props.frame))
/** The Size row's summary: the size as seen, or a Custom frame's own, then the Estimated size. */
const sizeSummary = computed(() => {
  if (!held.value) return undefined
  const size = frameSizeWords(t.value, locale.value, props.project, props.frame)
  return [size, frameEstimate(t.value, locale.value, props.project, props.frame)].filter(Boolean).join(' · ')
})

const toolsEl = ref<HTMLElement>()
const roving = useRovingFocus(toolsEl, { selector: '.frame-popover__tile', managesTabIndex: true })
onBeforeUnmount(() => emit('settle'))
</script>

<template>
  <div class="frame-popover" data-testid="frame-popover" :data-frame="frame">
    <div class="frame-popover__head">
      <span class="frame-popover__name" data-user-text data-testid="frame-popover-name">{{ name }}</span>
      <span class="frame-popover__meta" data-testid="frame-popover-meta">{{ meta }}</span>
    </div>

    <div ref="toolsEl" class="frame-popover__tools" role="group" :aria-label="t.frame.margin.frameTools" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
      <AppButton
        v-for="item in items"
        :key="item.id"
        variant="text"
        class="frame-popover__tile"
        :class="{ 'frame-popover__tile--danger': item.id === 'remove' }"
        :action="item.action"
        :deps="deps"
        :icon-size="20"
        :selected="item.checked"
        :aria-label="item.action.name(t)"
        :data-testid="`margin-frame-tools-${item.id}`"
        @click="emit('tool', item)"
      >
        <span>{{ t.frame.margin.tiles[item.id] }}</span>
      </AppButton>
    </div>

    <FramePopoverNames :project="project" :frame="frame" @rename="emit('rename', $event)" @save-maker-name="emit('save-maker-name', $event)" />
    <FramePopoverBead :project="project" :frame="frame" @replace-bead="emit('replace-bead', $event)" @set-technique="emit('set-technique', $event)" @set-setting="(id, value) => emit('set-setting', id, value)" @reset-progress="emit('reset-progress')" />
    <PanelSection id="frame-popover:size" :label="t.frame.sizeHeading" :summary="sizeSummary" folded data-testid="frame-popover-size">
      <div class="frame-popover__body">
        <FrameSizeSection :project="project" :frame="frame" @step="(edge, step) => emit('step', edge, step)" @resize="(columns, rows) => emit('resize', columns, rows)" @set-settings="emit('set-settings', $event)" @reset-progress="emit('reset-progress')" />
      </div>
    </PanelSection>
    <FramePopoverProgress :project="project" :frame="frame" :row-highlight="rowHighlight" :row-press="rowPress" @move-row="emit('move-row', $event)" @set-row-direction="emit('set-row-direction', $event)" @toggle-row-highlight="emit('toggle-row-highlight')" @reset-progress="emit('reset-progress')" />
    <BeadQuantities :project="beadsProject" folded />
  </div>
</template>

<style scoped>
.frame-popover {
  --panel-item-height: var(--panel-row);

  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--ink);
}

.frame-popover__head {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--space-4) var(--space-10) var(--space-6);
}

.frame-popover__name {
  overflow: hidden;
  font: var(--margin-roomy-name);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frame-popover__meta {
  font: var(--type-meta);
  color: var(--muted);
}

/* The tools: tiles three by two, a 20px icon over a short word. */
.frame-popover__tools {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.frame-popover__tools :deep(.app-button-wrap) {
  display: flex;
  min-width: 0;
}

.frame-popover__tools :deep(.frame-popover__tile) {
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
  height: auto;
  min-height: var(--frame-popover-tile);
  padding: var(--space-6) var(--space-2);
  font: var(--type-small);
  white-space: normal;
  text-align: center;
  overflow-wrap: anywhere;
  border-color: var(--line-soft);
  border-radius: var(--radius-sm);
}

.frame-popover__tools :deep(.frame-popover__tile--danger:not([aria-disabled='true'])) {
  color: var(--danger);
}

/* A narrow window gives the tiles two columns, so the longest word keeps to one line. */
@media (max-width: 380px) {
  .frame-popover__tools {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Mirror the whole Frame on: the band's own selected look, in the accent. */
.frame-popover__tools :deep(.frame-popover__tile.app-button--selected) {
  color: var(--on-accent);
  background: var(--accent);
  border-color: var(--accent);
}

.frame-popover__tools :deep(.frame-popover__tile.app-button--selected:focus-visible) {
  outline-color: var(--focus-ring-on-accent);
}

/* A folded row: its name keeps its room, and the summary wraps at the end rather than being cut, onto a line of its own
 * where not even its longest word fits beside the name. */
.frame-popover :deep(.panel-section__header),
.frame-popover :deep(.panel-section__row) {
  flex-wrap: wrap;
}

.frame-popover :deep(.panel-section__header > .panel-section__label),
.frame-popover :deep(.panel-section__row > .panel-section__label) {
  flex: 0 0 auto;
}

.frame-popover :deep(.panel-section__header > .panel-section__chevron) {
  margin-left: auto;
}

.frame-popover :deep(.panel-section__summary:not(.panel-section__summary--kept)) {
  flex: 1 1 0;
  min-width: min-content;
  overflow: visible;
  text-align: right;
  white-space: normal;
}

/* Names is the maker's own words, cut with an ellipsis instead. */
.frame-popover :deep(.panel-section__summary:has([data-user-text])) {
  min-width: 0;
}

.frame-popover :deep(.frame-popover__body) {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-10);
}

/* A finger's rows and tiles, so no two hit areas overlap. */
@media (pointer: coarse) {
  .frame-popover {
    --panel-item-height: var(--touch-target);
  }

  .frame-popover__tools :deep(.frame-popover__tile) {
    min-height: calc(var(--touch-target) + var(--space-16));
  }
}
</style>
