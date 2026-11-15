<script setup lang="ts">
import { computed } from 'vue'
import type { Layer } from '../../domain/grid'
import { frameOf } from '../../domain/layerRecord'
import type { Background, Project } from '../../domain/project'
import type { Technique } from '../../domain/weave'
import type { ImageRejection } from '../../domain/imageConversion'
import type { OpacityStep } from '../../domain/referenceImage'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import PanelItem from '../shell/PanelItem.vue'
import PanelSection from '../shell/PanelSection.vue'
import LayerSettings from './LayerSettings.vue'
import ProjectHead from './ProjectHead.vue'
import ReferenceImageSection from './ReferenceImageSection.vue'
import { layerSettingsOf, layerSummary } from './layerSettingsOf'

// The body of Project (spec 0440, tickets 443, 554, 0670; ProjectPanel card): everything about the open Project that no
// tool already does. A head (title, name, maker), then three sections that fold shut: the Canvas's Layer settings, the
// reference image (0790) and this project (the Project file first, one row to Export, 0956). It only asks.
const props = defineProps<{
  project: Project
  saveFailed: boolean
  unsaved: boolean
  /** The Project is open in another tab (ticket 0937): its save state says nothing here is saved. */
  openElsewhere?: boolean
  /** The reference image's picture as the app holds it (ticket 0790): its thumbnail, whether one is being made ready,
   * why the last file was refused, and whether the device keeps it. */
  reference?: { thumbnail?: string; preparing: boolean; refusal?: ImageRejection; notSaved: boolean }
  /** The Save row's value: the Project's Linked file's name (ADR 0090), else its last saved file's (ticket 0859); none
   * before its first. */
  lastFileName?: string
  /** Save as is offered only where the browser can link a file (ADR 0090). */
  canSaveAs?: boolean
}>()
const emit = defineEmits<{
  rename: [name: string]
  /** The Canvas's Layer settings (ticket 0670), each naming its layer as the Frame panel's do. */
  'set-technique': [layer: Layer, technique: Technique]
  'set-weave-setting': [layer: Layer, id: string, value: number]
  'set-background': [layer: Layer, background: Background]
  'replace-bead': [layer: Layer, beadId: string]
  'pick-reference-image': [file: File]
  'set-reference-opacity': [opacity: OpacityStep]
  'adjust-reference-image': []
  'remove-reference-image': []
  save: []
  /** Save and Save as (ADR 0090, ticket 0796), the actions the save ring and the keys also run. */
  'save-project-file': []
  'save-project-file-as': []
  /** The one Export row (ticket 0956): open the Export panel, as the Canvas strip's Export button opens it. */
  export: []
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
const save = controlAction('save-project-file')
const saveAs = controlAction('save-project-file-as')
const exportPanel = controlAction('strip-export')

const canvas = computed(() => layerSettingsOf(props.project, 'canvas'))
/** The Canvas section's header (ticket 0935): with a Frame on the Canvas it says it sets the Canvas outside it. */
const canvasLabel = computed(() => (frameOf(props.project) ? t.value.layerSettings.canvasOutsideFrame : t.value.panels.project.canvas))
/** The folded Canvas section's summary: its Technique and Bead. */
const canvasSummary = computed(() => layerSummary(t.value, canvas.value))
</script>

<template>
  <div class="project-panel" data-testid="project-panel">
    <ProjectHead
      :project="project"
      :save-failed="saveFailed"
      :unsaved="unsaved"
      :reference-not-saved="reference?.notSaved"
      :open-elsewhere="openElsewhere"
      @rename="emit('rename', $event)"
      @save-maker-name="emit('save-maker-name', $event)"
      @save="emit('save')"
    />

    <PanelSection id="project:canvas" :label="canvasLabel" :summary="canvasSummary">
      <LayerSettings
        v-bind="canvas"
        :background="backgrounds.shownOf('canvas').background"
        testid="canvas"
        @set-technique="emit('set-technique', 'canvas', $event)"
        @set-setting="(id, value) => emit('set-weave-setting', 'canvas', id, value)"
        @pick-bead="emit('replace-bead', 'canvas', $event)"
        @set-background="emit('set-background', 'canvas', $event)"
      />
    </PanelSection>

    <ReferenceImageSection
      :image="project.referenceImage"
      :thumbnail="reference?.thumbnail"
      :preparing="reference?.preparing"
      :refusal="reference?.refusal"
      @pick="emit('pick-reference-image', $event)"
      @set-opacity="emit('set-reference-opacity', $event)"
      @adjust="emit('adjust-reference-image')"
      @remove="emit('remove-reference-image')"
    />

    <PanelSection id="project:this" :label="t.panels.project.thisProject" folded data-testid="project-this">
      <PanelItem :icon="save.icon" :value="lastFileName ?? '.openbeads'" stays data-testid="save-project-file" @select="emit('save-project-file')">{{ save.name(t) }}</PanelItem>
      <PanelItem v-if="canSaveAs" :icon="saveAs.icon" stays data-testid="save-project-file-as" @select="emit('save-project-file-as')">{{ saveAs.name(t) }}</PanelItem>
      <PanelItem icon="copy" data-testid="project-duplicate" @select="emit('duplicate')">{{ duplicate.name(t) }}</PanelItem>
      <PanelItem :icon="exportPanel.icon" sub data-testid="project-export" @select="emit('export')">{{ exportPanel.name(t) }}</PanelItem>
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
