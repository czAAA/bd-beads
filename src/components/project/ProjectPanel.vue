<script setup lang="ts">
import { computed } from 'vue'
import { layerOf } from '../../domain/layerRecord'
import type { Layer } from '../../domain/grid'
import type { LayerBeadChoice } from '../../composables/palette/useReplaceBeadFlow'
import type { Background, Project } from '../../domain/project'
import type { BeadShape, Technique } from '../../domain/weave'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import PanelItem from '../shell/PanelItem.vue'
import PanelSection from '../shell/PanelSection.vue'
import BackgroundChip from './BackgroundChip.vue'
import BackgroundSection from './BackgroundSection.vue'
import BeadSection from './BeadSection.vue'
import ProjectHead from './ProjectHead.vue'

// The body of Project (spec 0440, tickets 443, 554; ProjectPanel card): what no tool already does. A head (title with the
// save state, name, maker, Technique), then four sections that fold shut: bead, canvas (its Bead, ticket 0687, and
// Background), export and this project. It only asks; the app shell does the work (Picture and chart: Frame panel).
const props = defineProps<{
  project: Project
  /** What the Canvas's Bead could switch to (tickets 48, 0687). */
  canvasBeadChoice: LayerBeadChoice
  saveFailed: boolean
  unsaved: boolean
}>()
const emit = defineEmits<{
  rename: [name: string]
  'set-technique': [technique: Technique]
  'set-canvas-technique': [technique: Technique]
  'set-weave-setting': [layer: Layer, id: string, value: number]
  'set-bead-shape': [shape: BeadShape]
  /** A layer's Background picked (ticket 0666): here the Canvas's. */
  'set-background': [layer: Layer, background: Background]
  /** A Bead picked for the Canvas (ticket 0687), to confirm. */
  'replace-bead': [beadId: string]
  save: []
  'export-project-file': []
  'save-maker-name': [name: string]
  duplicate: []
  clear: []
  delete: []
}>()

const { t } = useI18n()
const canvas = useCanvasBackground(() => props.project)
const duplicate = controlAction('duplicate-project')
const remove = controlAction('delete-project')
const clear = controlAction('clear-project')
const file = controlAction('export-project-file')

/** The Canvas's own layer (ticket 0687): its Bead is the Canvas section's, and its Bead shape, which both layers share
 * until ticket 0670, the bead section's. */
const canvasLayer = computed(() => layerOf(props.project, 'canvas'))

const beadSummary = computed(() => (canvasLayer.value.beadShape === 'real' ? t.value.form.beadShapeReal : t.value.form.beadShapeSymmetric).toLowerCase())

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
      @set-technique="emit('set-technique', $event)"
      @set-canvas-technique="emit('set-canvas-technique', $event)"
      @set-weave-setting="(layer, id, value) => emit('set-weave-setting', layer, id, value)"
    />

    <PanelSection id="project:bead" :label="t.panels.project.bead" :summary="beadSummary">
      <BeadSection :bead-shape="canvasLayer.beadShape" @update:bead-shape="emit('set-bead-shape', $event!)" />
    </PanelSection>

    <PanelSection id="project:canvas" :label="t.panels.project.canvas" data-testid="project-canvas">
      <template v-if="canvas.background.value" #summary>
        <BackgroundChip :background="canvas.background.value" />
      </template>
      <BeadSection
        :bead="canvasLayer.bead"
        :candidates="canvasBeadChoice.candidates"
        :outdated="canvasBeadChoice.outdated"
        @pick="emit('replace-bead', $event)"
      />
      <BackgroundSection :project="project" layer="canvas" @pick="emit('set-background', 'canvas', $event)" />
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
