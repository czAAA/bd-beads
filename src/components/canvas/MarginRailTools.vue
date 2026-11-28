<script setup lang="ts">
import { computed, ref } from 'vue'
import type { controlDeps } from '../../composables/shell/controlRegistry'
import { soloFrame } from '../../domain/layerRecord'
import type { FrameId } from '../../domain/grid'
import type { Background, Project } from '../../domain/project'
import type { ExportChoice } from '../../composables/shell/openPanel'
import { useI18n } from '../../i18n/useI18n'
import PanelItem from '../shell/PanelItem.vue'
import ExportSection from './ExportSection.vue'
import MarginColorChoices from './MarginColorChoices.vue'
import type { FrameToolItem } from './framePopoverTools'

// The expanded sheet's right rail (MarginSheet card, Calmer sheet 3; ticket 1260): the Frame's tools with their words,
// Export and Margin color unfolding downward under their rows, never a popover. Each row is a second trigger of an
// existing action, with its name, check and reason for being off.
const props = defineProps<{
  project: Project
  frame: FrameId
  items: readonly FrameToolItem[]
  deps: ReturnType<typeof controlDeps>
  /** Whether Edit Frame is on: its row is pressed. */
  editing: boolean
  /** A PNG or PDF is being drawn. */
  exporting?: ExportChoice
}>()

const emit = defineEmits<{
  'export-png': [part: Project]
  'export-pdf': [typedName: undefined, part: Project]
  'save-project-file': []
  'save-maker-name': [name: string]
  'set-background': [background: Background]
}>()

const { t } = useI18n()
/** The rows unfolded now: both may be at once, and both fold as the Frame is left. */
const unfolded = ref(new Set<string>())
/** The Project of this Frame alone: what its export rows count and save. */
const solo = computed(() => soloFrame(props.project, props.frame))

const rows = computed(() =>
  props.items.map((item) => {
    const folds = item.id === 'export' || item.id === 'color'
    const pressed = item.id === 'mirror' ? !!item.checked : item.id === 'edit' ? props.editing : undefined
    const name = item.id === 'mirror' && item.checked ? t.value.mirror.mirrorOff : item.action.name(t.value)
    const disabled = item.action.enabled ? !item.action.enabled(props.deps) : false
    return { item, folds, pressed, name, disabled, disabledBody: disabled ? item.action.disabledBody?.(t.value, props.deps) : undefined }
  }),
)

function press(item: FrameToolItem, folds: boolean) {
  if (!folds) return item.run()
  const next = new Set(unfolded.value)
  if (!next.delete(item.id)) next.add(item.id)
  unfolded.value = next
}
</script>

<template>
  <div class="margin-rail-tools" role="group" :aria-label="t.frame.margin.frameTools" data-testid="margin-rail-tools">
    <span class="margin-rail-tools__heading" aria-hidden="true">{{ t.frame.margin.frameTools }}</span>
    <div class="margin-rail-tools__rows">
      <template v-for="row in rows" :key="row.item.id">
        <hr v-if="row.item.id === 'remove'" class="margin-rail-tools__rule" />
        <div class="margin-rail-tools__tool" :class="{ 'margin-rail-tools__tool--wide': row.folds && unfolded.has(row.item.id) }">
          <PanelItem
            :icon="row.item.action.icon"
            :expanded="row.folds ? unfolded.has(row.item.id) : undefined"
            :danger="row.item.id === 'remove'"
            :disabled="row.disabled"
            :name="row.name"
            :disabled-body="row.disabledBody"
            :class="['margin-rail-tools__row', { 'margin-rail-tools__row--on': row.item.id === 'mirror' && row.pressed, 'margin-rail-tools__row--editing': row.item.id === 'edit' && row.pressed }]"
            :aria-pressed="row.pressed"
            :data-testid="`margin-rail-${row.item.id}`"
            @select="press(row.item, row.folds)"
          >
            {{ row.name }}
          </PanelItem>
          <ExportSection
            v-if="row.item.id === 'export' && unfolded.has('export')"
            rail
            :project="solo"
            :exporting="exporting"
            @export-png="emit('export-png', solo)"
            @export-pdf="emit('export-pdf', undefined, solo)"
            @save-project-file="emit('save-project-file')"
            @save-maker-name="emit('save-maker-name', $event)"
          />
          <MarginColorChoices v-if="row.item.id === 'color' && unfolded.has('color')" class="margin-rail-tools__color" rail :project="project" :frame="frame" @set-background="emit('set-background', $event)" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.margin-rail-tools {
  --panel-item-height: var(--panel-row);
  --swatch-gap: var(--margin-fill);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.margin-rail-tools__heading {
  padding: var(--space-4) var(--space-6);
  font: var(--type-small);
  color: var(--muted);
}

.margin-rail-tools__rows {
  display: flex;
  flex-direction: column;
}

.margin-rail-tools__rows :deep(.margin-rail-tools__row.panel-item) {
  padding-inline: var(--space-6);
}

/* A long name wraps beside its icon, never under it. */
.margin-rail-tools__rows :deep(.panel-item__label) {
  flex: 1 1 0;
  min-width: 0;
  overflow-wrap: break-word;
}

/* The rail is quiet: a folded row reads in `ink`, its chevron `muted`, down while folded and up once unfolded. */
.margin-rail-tools__rows :deep(.panel-item--folded) {
  color: var(--ink);
}

.margin-rail-tools__rows :deep(.panel-item--folded .panel-item__mark) {
  color: var(--muted);
}

.margin-rail-tools__rows :deep(.margin-rail-tools__row.panel-item[aria-expanded] .panel-item__mark) {
  transform: rotate(180deg);
}

.margin-rail-tools__rows :deep(.margin-rail-tools__row.panel-item[aria-expanded='false'] .panel-item__mark) {
  transform: rotate(-90deg);
}

.margin-rail-tools__rows :deep(.margin-rail-tools__row.panel-item[aria-expanded='true']) {
  background: var(--hover-fill);
}

/* Mirror the whole Frame on is the accent, as on the band; Edit Frame on is `ink`. */
.margin-rail-tools__rows :deep(.margin-rail-tools__row--on.panel-item),
.margin-rail-tools__rows :deep(.margin-rail-tools__row--on.panel-item:hover) {
  color: var(--on-accent);
  background: var(--accent);
}

.margin-rail-tools__rows :deep(.margin-rail-tools__row--on.panel-item:focus-visible) {
  outline-color: var(--focus-ring-on-accent);
}

.margin-rail-tools__rows :deep(.margin-rail-tools__row--editing.panel-item),
.margin-rail-tools__rows :deep(.margin-rail-tools__row--editing.panel-item:hover) {
  color: var(--canvas);
  background: var(--ink);
}

.margin-rail-tools__color {
  padding: var(--space-4) var(--space-6) var(--space-8) calc(var(--space-6) + var(--space-16) + var(--space-8));
}

.margin-rail-tools__rule {
  width: 100%;
  margin: var(--space-4) 0;
  border: 0;
  border-top: 1px solid var(--margin-line);
}

@media (pointer: coarse) {
  .margin-rail-tools {
    --panel-item-height: var(--touch-target);
  }
}
</style>
