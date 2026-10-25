<script setup lang="ts">
import { computed } from 'vue'
import { beadLabel, type Bead } from '../../domain/beads'
import { resolveProjectBead, type Project } from '../../domain/project'
import { DEFAULT_BEAD_SHAPE, type BeadShape, type Technique } from '../../domain/weave'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import PanelItem from '../shell/PanelItem.vue'
import PanelSection from '../shell/PanelSection.vue'
import CanvasSection from './CanvasSection.vue'
import ProjectBeadSection from './ProjectBeadSection.vue'
import ProjectHead from './ProjectHead.vue'

// The body of Project (spec 0440, tickets 443, 554; ProjectPanel card): everything about the open Project that no tool
// already does. A head (title with the save state, name, maker, Technique), then four sections that fold shut: bead,
// canvas, export and this project. It only asks; the app shell does the work (Picture and chart: Frame panel, ticket 555).
const props = defineProps<{
  project: Project
  /** What the Project could switch to (ticket 48). */
  replaceCandidates: readonly Bead[]
  saveFailed: boolean
  unsaved: boolean
}>()
const emit = defineEmits<{
  rename: [name: string]
  'set-technique': [technique: Technique]
  'set-brick-block': [brickBlock: number]
  'set-canvas-technique': [technique: Technique]
  'set-canvas-brick-block': [brickBlock: number]
  'set-bead-shape': [shape: BeadShape]
  'replace-bead': [beadId: string]
  save: []
  'export-project-file': []
  'save-maker-name': [name: string]
  duplicate: []
  clear: []
  delete: []
}>()

const { t } = useI18n()
const canvas = useCanvasBackground()
const duplicate = controlAction('duplicate-project')
const remove = controlAction('delete-project')
const clear = controlAction('clear-project')
const file = controlAction('export-project-file')

const beadSummary = computed(() => {
  const bead = resolveProjectBead(props.project)
  const shape = (props.project.beadShape ?? DEFAULT_BEAD_SHAPE) === 'real' ? t.value.form.beadShapeReal : t.value.form.beadShapeSymmetric
  return bead ? `${beadLabel(bead, t.value.formFactors)} · ${shape.toLowerCase()}` : undefined
})

const canvasName = computed(() => {
  const background = canvas.background.value
  return background ? t.value.canvas.canvasColor.names[background.id] : undefined
})
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
      @set-brick-block="emit('set-brick-block', $event)"
      @set-canvas-technique="emit('set-canvas-technique', $event)"
      @set-canvas-brick-block="emit('set-canvas-brick-block', $event)"
    />

    <PanelSection id="project:bead" :label="t.panels.project.bead" :summary="beadSummary">
      <ProjectBeadSection :project="project" :candidates="replaceCandidates" @set-bead-shape="emit('set-bead-shape', $event)" @replace-bead="emit('replace-bead', $event)" />
    </PanelSection>

    <PanelSection id="project:canvas" :label="t.panels.project.canvas" :summary="canvasName">
      <template v-if="canvas.background.value" #summary>
        <span class="project-panel__chip" :style="{ backgroundColor: canvas.background.value.color }" aria-hidden="true" />{{ canvasName }}
      </template>
      <CanvasSection />
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

.project-panel__chip {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: var(--space-6);
  vertical-align: -1px;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}
</style>
