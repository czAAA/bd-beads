<script setup lang="ts">
import { computed } from 'vue'
import type { Layer } from '../../domain/grid'
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
// tool already does. A head (title with the save state, name, maker), then four sections that fold shut: the Canvas's
// Layer settings, the reference image (ticket 0790), export and this project. It only asks; the app shell does the work (the Frame's: Frame panel).
const props = defineProps<{
  project: Project
  saveFailed: boolean
  unsaved: boolean
  /** The reference image's picture as the app holds it (ticket 0790): its thumbnail, whether one is being made ready,
   * why the last file was refused, and whether the device keeps it. */
  reference?: { thumbnail?: string; preparing: boolean; refusal?: ImageRejection; notSaved: boolean }
  /** The Project's Linked file's name (ADR 0090), the Save row's value; none without one. */
  linkedFileName?: string
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
      :reference-not-saved="reference?.notSaved"
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

    <PanelSection id="project:export" :label="t.panels.project.exportHeading">
      <PanelItem :icon="save.icon" :value="linkedFileName ?? '.openbeads'" stays data-testid="save-project-file" @select="emit('save-project-file')">{{ save.name(t) }}</PanelItem>
      <PanelItem v-if="canSaveAs" :icon="saveAs.icon" stays data-testid="save-project-file-as" @select="emit('save-project-file-as')">{{ saveAs.name(t) }}</PanelItem>
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
