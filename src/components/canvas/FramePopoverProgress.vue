<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { RowPress } from '../../composables/project/useRowOps'
import type { FrameId } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { columnsAsSeen, frameRowOrder, ROW_WAYS, rowProgressPosition, seenWayOf, type SeenWay } from '../../domain/rowProgress'
import { rowProgressCount, seenWayWords } from '../../i18n/rowProgressWords'
import { useI18n } from '../../i18n/useI18n'
import PanelPicker from '../shell/PanelPicker.vue'
import PanelSection from '../shell/PanelSection.vue'
import AppButton from '../ui/AppButton.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import IconButton from '../ui/IconButton.vue'
import ProgressTrack from './ProgressTrack.vue'

// The Frame popover's Row progress (MarginSheet card, Calmer sheet; ticket 1257): the strip's controls as second
// triggers, with room for their words. Reset progress stays on the row, folded or open.
const props = defineProps<{
  project: Project
  frame: FrameId
  rowHighlight?: boolean
  /** The last press of Row done or Back a row, wherever it was made (ticket 0730): Row done flares the spark. */
  rowPress?: RowPress
}>()
const emit = defineEmits<{
  'move-row': [delta: number]
  'set-row-direction': [way: SeenWay]
  'toggle-row-highlight': []
  'reset-progress': []
}>()

const { t } = useI18n()
const deps = computed(() => controlDeps({ activeProject: () => props.project, frame: () => props.frame }))
const actions = { done: controlAction('row-done'), back: controlAction('row-not-done'), reset: controlAction('reset-progress') }
const canReset = computed(() => !!actions.reset.enabled?.(deps.value))
const position = computed(() => rowProgressPosition(props.project, props.frame))
const columnWise = computed(() => columnsAsSeen(props.project, props.frame))
const count = computed(() => rowProgressCount(t.value.rowProgress, props.project, props.frame))
const counter = computed(() => [count.value.step, count.value.line].filter(Boolean).join(' '))
const way = computed(() => seenWayOf(props.project, props.frame))
/** A Custom frame's rows run one way only: no directions. */
const turns = computed(() => frameRowOrder(props.project, props.frame).turns)
const ways = computed(() => ROW_WAYS.map((value) => ({ value, label: seenWayWords(t.value.rowProgress, value).name })))

const flares = ref(0)
watch(
  () => props.rowPress,
  (press) => {
    if (press?.done && press.frame === props.frame) flares.value += 1
  },
)
</script>

<template>
  <PanelSection id="frame-popover:progress" :label="t.toolbox.groups.rowProgress" :summary="counter" folded data-testid="frame-popover-row-progress">
    <template #info>
      <IconButton variant="plain" :action="actions.reset" :deps="deps" data-testid="frame-popover-reset-icon" @click="emit('reset-progress')" />
    </template>
    <div class="frame-popover__body">
      <div class="frame-progress__moves">
        <AppButton
          :action="actions.back"
          :label="columnWise ? t.rowProgress.columnPreviousButton : t.rowProgress.previousButton"
          :disabled="position.current === 0"
          data-testid="frame-popover-previous"
          @click="emit('move-row', -1)"
        />
        <AppButton
          variant="primary"
          :action="actions.done"
          :label="columnWise ? t.rowProgress.columnNextButton : t.rowProgress.nextButton"
          :disabled="position.current >= position.total"
          :disabled-body="columnWise ? t.rowProgress.everyColumnDone : t.rowProgress.everyRowDone"
          data-testid="frame-popover-next"
          @click="emit('move-row', 1)"
        />
      </div>
      <p class="frame-progress__count" data-testid="frame-popover-position">{{ counter }}</p>
      <ProgressTrack
        class="frame-progress__track"
        :share="position.total > 0 ? position.current / position.total : 0"
        :flares="flares"
        compact
        glints
        :label="columnWise ? t.rowProgress.columnFinishedLabel : t.rowProgress.finishedLabel"
        :min="0"
        :max="position.total"
        :now="position.current"
        testid="frame-popover-progress"
      />
      <PanelPicker
        v-if="turns"
        class="frame-progress__way"
        :label="t.rowProgress.directionButton"
        :model-value="way"
        :options="ways"
        data-testid="frame-popover-direction"
        @update:model-value="emit('set-row-direction', $event)"
      />
      <label class="frame-progress__marks">
        <span>{{ t.rowProgress.showRowMarks }}</span>
        <AppSwitch :model-value="!!rowHighlight" :label="t.rowProgress.showRowMarks" data-testid="frame-popover-row-marks" @update:model-value="emit('toggle-row-highlight')" />
      </label>
      <AppButton
        variant="text"
        class="frame-progress__reset"
        :action="actions.reset"
        :disabled="!canReset"
        :disabled-body="t.tooltips.noProgressToReset"
        data-testid="frame-popover-reset"
        @click="emit('reset-progress')"
      />
    </div>
  </PanelSection>
</template>

<style scoped>
/* Back a row and Row done side by side, one above the other where their words need it. */
.frame-progress__moves {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
}

.frame-progress__moves :deep(.app-button-wrap) {
  display: flex;
  flex: 1 1 0;
}

.frame-progress__moves :deep(.app-button) {
  flex: 1 1 auto;
}

.frame-progress__count {
  margin: 0;
  font: var(--type-small);
  color: var(--muted);
}

/* The whole groove is seen, however little is done. */
.frame-progress__track {
  flex: none;
}

.frame-progress__track :deep(.progress-track__groove) {
  border: 1px solid var(--line-strong);
}

.frame-progress__way {
  padding: 0;
}

.frame-progress__marks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
  font: var(--type-control);
  cursor: pointer;
}

.frame-popover__body :deep(.frame-progress__reset) {
  padding: 0;
}

.frame-progress__reset {
  align-self: flex-start;
}
</style>
