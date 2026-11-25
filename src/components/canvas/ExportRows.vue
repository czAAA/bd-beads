<script setup lang="ts">
import { computed } from 'vue'
import ExportSection from './ExportSection.vue'
import ProjectFileButton from './ProjectFileButton.vue'
import PanelItem from '../shell/PanelItem.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import MenuButton from '../ui/MenuButton.vue'
import { fitToDrawing } from '../../domain/frame'
import type { FrameId } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { frameLabel } from '../../i18n/frameLabel'
import { useI18n } from '../../i18n/useI18n'
import { frameById, frameIdOf, framesOf, frameOf, lastEditedFrameId, soloFrame } from '../../domain/layerRecord'
import type { ExportChoice } from '../../composables/shell/openPanel'

// What the Export panel holds (ticket 0652; ExportPanel card), also unfolded under the Project panel's Export row (1058):
// the export rows of one Frame (spec 1214), a Frame dropdown over them with several (1222); with none, the line, the ways
// to set one (Fit a Frame to the drawing, Drag a Frame), then File, which needs no Frame (ticket 1133).
const props = defineProps<{
  project: Project
  /** The Frame the rows are about: the Last edited Frame when none is named. */
  frame?: FrameId
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one. */
  exporting?: ExportChoice
  /** The row it opens on, focused (ticket 0847): Picture, from the Progress bar's Fit a Frame and export a picture. */
  opensOn?: ExportChoice
}>()

const emit = defineEmits<{
  fit: []
  'select-frame': []
  'select-piece-frame': []
  /** A Frame picked in the dropdown. */
  'pick-frame': [frame: FrameId]
  'export-png': []
  'export-pdf': [typedName?: string]
  'save-project-file': []
  'save-maker-name': [name: string]
}>()

const { t } = useI18n()
/** Fit a Frame to the drawing needs something drawn. */
const nothingToFit = computed(() => fitToDrawing(props.project) === undefined)
/** The Frames to choose from, and the one the rows are of. */
const frames = computed(() => framesOf(props.project))
const chosen = computed(() => (props.frame && frameById(props.project, props.frame) ? props.frame : lastEditedFrameId(props.project)))
const chosenName = computed(() => frameLabel(t.value, frameById(props.project, chosen.value) ?? {}, frames.value.findIndex((each) => each.id === chosen.value)))
/** The Project of the one Frame chosen: what the rows count and save. */
const solo = computed(() => soloFrame(props.project, chosen.value))
</script>

<template>
  <div v-if="frames.length > 1" class="export-rows__pick" data-testid="export-frame-pick">
    <span class="export-rows__pick-label">{{ t.frame.title }}</span>
    <MenuButton :label="chosenName" variant="secondary" align="end" data-testid="export-frame-button">
      <AppMenuItem v-for="(each, at) in frames" :key="each.id" :chosen="each.id === chosen" :data-testid="`export-frame-${each.id}`" @select="emit('pick-frame', frameIdOf(each))">
        <span data-user-text>{{ frameLabel(t, each, at) }}</span>
      </AppMenuItem>
    </MenuButton>
  </div>
  <ExportSection v-if="frameOf(project)" :project="solo" :exporting="exporting" :opens-on="opensOn" @export-png="emit('export-png')" @export-pdf="emit('export-pdf', $event)" @save-project-file="emit('save-project-file')" @save-maker-name="emit('save-maker-name', $event)" />
  <template v-else>
    <p class="export-rows__line" data-testid="export-needs-frame">{{ t.frame.exportNeedsFrame }}</p>
    <!-- The one-tap way first once something is drawn (ticket 0944); `frame`, as `fit` is the zoom's. -->
    <PanelItem v-if="!nothingToFit" icon="frame" stays data-testid="export-fit" :name="t.frame.fitAFrame" :body="t.tooltips.fitToDrawing" @select="emit('fit')">{{ t.frame.fitAFrame }}</PanelItem>
    <PanelItem icon="select" data-testid="export-select-frame" :name="t.frame.selectAFrame" :body="t.frame.selectFrameHint" @select="emit('select-frame')">{{ t.frame.selectAFrame }}</PanelItem>
    <PanelItem icon="piece" data-testid="export-select-piece-frame" @select="emit('select-piece-frame')">{{ t.frame.selectAPieceFrame }}</PanelItem>
    <PanelItem v-if="nothingToFit" icon="frame" stays disabled :name="t.frame.fitAFrame" :disabled-body="t.frame.fitNothing" data-testid="export-fit">{{ t.frame.fitAFrame }}</PanelItem>
    <div class="export-rows__files">
      <ProjectFileButton @save-project-file="emit('save-project-file')" />
    </div>
  </template>
</template>

<style scoped>
/* The Frame dropdown over the rows (ticket 1222): its name at the start, the button at the end. */
.export-rows__pick {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-10);
}

.export-rows__pick-label {
  font: var(--type-control);
  color: var(--ink);
}

/* File alone, the size it is beside PNG and PDF: a third of the row (ticket 1133). */
.export-rows__files {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-8);
  padding: var(--space-4) var(--space-10);
}

.export-rows__files :deep(.app-button-wrap),
.export-rows__files :deep(.app-button) {
  width: 100%;
}

.export-rows__line {
  margin: 0;
  padding: var(--space-4) var(--space-10);
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
