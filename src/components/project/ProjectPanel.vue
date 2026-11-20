<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { Layer } from '../../domain/grid'
import { frameOf } from '../../domain/layerRecord'
import type { Background, Project } from '../../domain/project'
import type { Technique } from '../../domain/weave'
import type { ImageRejection } from '../../domain/imageConversion'
import type { OpacityStep } from '../../domain/referenceImage'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import type { ExportChoice } from '../../composables/shell/openPanel'
import ExportRows from '../canvas/ExportRows.vue'
import PanelItem from '../shell/PanelItem.vue'
import PanelSection from '../shell/PanelSection.vue'
import LayerSettings from './LayerSettings.vue'
import ProjectHead from './ProjectHead.vue'
import ReferenceImageSection from './ReferenceImageSection.vue'
import { layerSettingsOf, layerSummary } from './layerSettingsOf'

// The body of Project (spec 0440, tickets 443, 554, 0670; ProjectPanel card): what no tool already does about the open
// Project. A head, two folding sections (the Canvas's Layer settings, the reference image, 0790), then the Project's own
// rows, always showing under no title: the Project file, Export (its rows unfold in place, 1058), Clear and Delete.
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
  /** A PNG or PDF is being drawn (ticket 1058): the unfolded export rows wait, as in the Export panel. */
  exporting?: ExportChoice
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
  'remove-reference-image': []
  save: []
  /** Save and Save as (ADR 0090, ticket 0796), the actions the save ring and the keys also run. */
  'save-project-file': []
  'save-project-file-as': []
  /** The rows the Export row unfolds (ticket 1058), the Export panel's: save a file, or set a Frame first. */
  'export-png': []
  'export-pdf': [typedName?: string]
  fit: []
  'select-frame': []
  'save-maker-name': [name: string]
  clear: []
  delete: []
}>()

const { t } = useI18n()
const backgrounds = useCanvasBackground(() => props.project)
const remove = controlAction('delete-project')
const clear = controlAction('clear-project')
const save = controlAction('save-project-file')
const saveAs = controlAction('save-project-file-as')
const exportAction = controlAction('strip-export')

/** The Export row's rows (ticket 1058): folded every time the panel opens and kept nowhere, as the Frame panel's are. */
const exportOpen = ref(false)
const exportRowsId = useId()

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
      @remove="emit('remove-reference-image')"
    />

    <div class="project-panel__rows" data-testid="project-rows">
      <PanelItem :icon="save.icon" :value="lastFileName ?? '.openbeads'" stays data-testid="save-project-file" @select="emit('save-project-file')">{{ save.name(t) }}</PanelItem>
      <PanelItem v-if="canSaveAs" :icon="saveAs.icon" stays data-testid="save-project-file-as" @select="emit('save-project-file-as')">{{ saveAs.name(t) }}</PanelItem>
      <PanelItem :icon="exportAction.icon" :expanded="exportOpen" :aria-controls="exportRowsId" data-testid="project-export" @select="exportOpen = !exportOpen">{{ exportAction.name(t) }}</PanelItem>
      <div v-if="exportOpen" :id="exportRowsId" class="project-panel__export" role="group" :aria-label="exportAction.name(t)" data-testid="project-export-rows">
        <ExportRows :project="project" :exporting="exporting" @fit="emit('fit')" @select-frame="emit('select-frame')" @export-png="emit('export-png')" @export-pdf="emit('export-pdf', $event)" @save-project-file="emit('save-project-file')" />
      </div>
      <PanelItem icon="erase" danger data-testid="project-clear" @select="emit('clear')">{{ clear.name(t) }}</PanelItem>
      <PanelItem icon="delete" danger data-testid="project-delete" @select="emit('delete')">{{ remove.name(t) }}</PanelItem>
    </div>
  </div>
</template>

<style scoped>
.project-panel {
  display: flex;
  flex-direction: column;
  color: var(--ink);
}

/* The rows under no title, set off from the sections above as a section is (PanelSection). */
.project-panel__rows {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--line-soft);
}

.project-panel__export {
  display: flex;
  flex-direction: column;
}

.project-panel > :deep(.panel-section:first-of-type) {
  margin-top: var(--space-4);
}
</style>
