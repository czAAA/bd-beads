<script setup lang="ts">
import { computed } from 'vue'
import type { Layer } from '../../domain/grid'
import type { Background, Project } from '../../domain/project'
import type { BeadShape, Technique } from '../../domain/weave'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import PanelItem from '../shell/PanelItem.vue'
import PanelSection from '../shell/PanelSection.vue'
import LayerSettings from './LayerSettings.vue'
import ProjectHead from './ProjectHead.vue'
import { layerSettingsOf, layerSummary } from './layerSettingsOf'

// The body of Project (spec 0440, tickets 443, 554, 0670; ProjectPanel card): everything about the open Project that no
// tool already does. A head (title with the save state, name, maker), then three sections that fold shut: the Canvas's
// Layer settings, export and this project. It only asks; the app shell does the work (the Frame's: Frame panel).
const props = defineProps<{
  project: Project
  saveFailed: boolean
  unsaved: boolean
}>()
const emit = defineEmits<{
  rename: [name: string]
  /** The Canvas's Layer settings (ticket 0670), each naming its layer as the Frame panel's do. */
  'set-technique': [layer: Layer, technique: Technique]
  'set-weave-setting': [layer: Layer, id: string, value: number]
  'set-bead-shape': [layer: Layer, shape: BeadShape]
  'set-background': [layer: Layer, background: Background]
  'replace-bead': [layer: Layer, beadId: string]
  save: []
  'export-project-file': []
  'save-maker-name': [name: string]
  duplicate: []
  clear: []
  delete: []
}>()

const { t } = useI18n()
const backgrounds = useCanvasBackground(() => props.project)
const duplicate = controlAction('duplicate-project')
const remove = controlAction('delete-project')
const clear = controlAction('clear-project')
const file = controlAction('export-project-file')

const canvas = computed(() => layerSettingsOf(props.project, 'canvas'))
/** The folded Canvas section's summary: its Technique and Bead. */
const canvasSummary = computed(() => layerSummary(t.value, canvas.value))
</script>

<template>
  <div class="project-panel" data-testid="project-panel">
    <ProjectHead
      :project="project"
      :save-failed="saveFailed"
      :unsaved="unsaved"
      @rename="emit('rename', $event)"
      @save-maker-name="emit('save-maker-name', $event)"
      @save="emit('save')"
    />

    <PanelSection id="project:canvas" :label="t.panels.project.canvas" :summary="canvasSummary">
      <LayerSettings
        v-bind="canvas"
        :background="backgrounds.shownOf('canvas').background"
        testid="canvas"
        @set-technique="emit('set-technique', 'canvas', $event)"
        @set-setting="(id, value) => emit('set-weave-setting', 'canvas', id, value)"
        @pick-bead="emit('replace-bead', 'canvas', $event)"
        @set-bead-shape="emit('set-bead-shape', 'canvas', $event)"
        @set-background="emit('set-background', 'canvas', $event)"
      />
    </PanelSection>

    <PanelSection id="project:export" :label="t.panels.project.exportHeading">
      <PanelItem icon="export" value=".openbeads" stays data-testid="export-project-file" @select="emit('export-project-file')">{{ file.name(t) }}</PanelItem>
    </PanelSection>

    <PanelSection id="project:this" :label="t.panels.project.thisProject">
      <PanelItem icon="copy" data-testid="project-duplicate" @select="emit('duplicate')">{{ duplicate.name(t) }}</PanelItem>
      <PanelItem icon="erase" danger data-testid="project-clear" @select="emit('clear')">{{ clear.name(t) }}</PanelItem>
      <PanelItem icon="delete" danger data-testid="project-delete" @select="emit('delete')">{{ remove.name(t) }}</PanelItem>
    </PanelSection>
  </div>
</template>

<style scoped>
.project-panel {
  display: flex;
  flex-direction: column;
  color: var(--ink);
}

.project-panel > :deep(.panel-section:first-of-type) {
  margin-top: var(--space-4);
}
</style>
